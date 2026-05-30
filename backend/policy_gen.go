package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/open-policy-agent/opa/rego"
)

// GenerateRego creates a customized Open Policy Agent (Rego) policy string.
func GenerateRego(user string, resource string, permission string, riskScore int) string {
	cleanUser := strings.ReplaceAll(user, "@", "_")
	cleanUser = strings.ReplaceAll(cleanUser, ".", "_")

	return fmt.Sprintf(`package access

# Default deny access
default allow = false

# Access rule for JIT Request
allow {
    input.user == "%s"
    input.resource == "%s"
    input.action == "%s"
    input.risk_score <= %d
}

# Policy constraints
deny[msg] {
    input.action == "write"
    input.risk_score > 70
    msg := "Write actions are blocked on resources with risk scores above 70 without manual override."
}
`, cleanUser, resource, permission, riskScore)
}

// EvaluatePolicy runs the generated Rego policy using the embedded OPA engine.
func EvaluatePolicy(ctx context.Context, regoCode string, user string, resource string, action string, riskScore int) (bool, string, error) {
	cleanUser := strings.ReplaceAll(user, "@", "_")
	cleanUser = strings.ReplaceAll(cleanUser, ".", "_")

	// Input map to evaluate against Rego rules
	input := map[string]interface{}{
		"user":       cleanUser,
		"resource":   resource,
		"action":     action,
		"risk_score": riskScore,
	}

	// Create OPA Rego Query
	r := rego.New(
		rego.Query("data.access.allow"),
		rego.Module("policy.rego", regoCode),
	)

	// Prepare evaluation query
	pq, err := r.PrepareForEval(ctx)
	if err != nil {
		return false, "Failed to prepare OPA query: " + err.Error(), err
	}

	// Evaluate
	results, err := pq.Eval(ctx, rego.EvalInput(input))
	if err != nil {
		return false, "Failed during policy evaluation: " + err.Error(), err
	}

	// Parse results
	if len(results) > 0 && len(results[0].Expressions) > 0 {
		allowed, ok := results[0].Expressions[0].Value.(bool)
		if ok && allowed {
			return true, "Access allowed by OPA policy constraints.", nil
		}
	}

	// Check if there are any explicit denials
	rDeny := rego.New(
		rego.Query("data.access.deny"),
		rego.Module("policy.rego", regoCode),
	)
	pqDeny, err := rDeny.PrepareForEval(ctx)
	if err == nil {
		denyResults, err := pqDeny.Eval(ctx, rego.EvalInput(input))
		if err == nil && len(denyResults) > 0 && len(denyResults[0].Expressions) > 0 {
			if list, ok := denyResults[0].Expressions[0].Value.([]interface{}); ok && len(list) > 0 {
				return false, fmt.Sprintf("Access denied: %v", list[0]), nil
			}
		}
	}

	return false, "Access denied by OPA. Policy constraints not satisfied.", nil
}
