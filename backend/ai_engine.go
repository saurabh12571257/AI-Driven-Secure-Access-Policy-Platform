package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
)

// ParsedRequest represents the JSON output from parsing natural language access requests.
type ParsedRequest struct {
	Resource   string `json:"resource"`
	Permission string `json:"permission"`
	Duration   string `json:"duration"`
	Reason     string `json:"reason"`
}

// AIResponse maps Gemini response structure
type GeminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func getGeminiKey() string {
	return os.Getenv("GEMINI_API_KEY")
}

// CallGemini sends a prompt to the Gemini API using the developer key.
func CallGemini(prompt string) (string, error) {
	key := getGeminiKey()
	if key == "" {
		return "", fmt.Errorf("GEMINI_API_KEY environment variable not set")
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + key

	requestBody, err := json.Marshal(map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"responseMimeType": "application/json",
		},
	})
	if err != nil {
		return "", err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(requestBody))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Gemini API error (Status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(bodyBytes, &geminiResp); err != nil {
		return "", err
	}

	if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
		return geminiResp.Candidates[0].Content.Parts[0].Text, nil
	}

	return "", fmt.Errorf("empty response from Gemini model")
}

// ParseAccessRequest parses natural language requests using LLM (or offline fallback).
func ParseAccessRequest(userInput string) ParsedRequest {
	prompt := fmt.Sprintf(`
Analyze this access request: "%s"
Extract the target resource, permission level, duration, and reason.
Output strictly JSON format with the following keys:
- "resource": must match or map closely to one of these: [prod-db, prod-logs, staging-k8s, s3-bucket-analytics, grafana-dashboard]
- "permission": must be either "read", "write", or "admin" (default to "read" if unspecified)
- "duration": a duration specifier (e.g. "2h", "30m", "1h")
- "reason": description of why the user needs access.
`, userInput)

	resStr, err := CallGemini(prompt)
	if err == nil {
		var parsed ParsedRequest
		// Clean json markers if present
		cleanStr := strings.TrimSpace(resStr)
		cleanStr = strings.TrimPrefix(cleanStr, "```json")
		cleanStr = strings.TrimSuffix(cleanStr, "```")
		cleanStr = strings.TrimSpace(cleanStr)

		if err := json.Unmarshal([]byte(cleanStr), &parsed); err == nil {
			return parsed
		}
		log.Printf("Failed to unmarshal Gemini JSON: %s, error: %v", resStr, err)
	}

	// Local Fallback Parser
	log.Println("Using rule-based local parser fallback for NLP interpretation.")
	return fallbackParse(userInput)
}

func fallbackParse(userInput string) ParsedRequest {
	req := ParsedRequest{
		Permission: "read", // default
		Duration:   "1h",  // default
		Reason:     "No reason specified",
	}

	lowerInput := strings.ToLower(userInput)

	// Resource matching
	if strings.Contains(lowerInput, "prod-db") || strings.Contains(lowerInput, "production db") || strings.Contains(lowerInput, "production database") || strings.Contains(lowerInput, "prod db") {
		req.Resource = "prod-db"
	} else if strings.Contains(lowerInput, "prod-logs") || strings.Contains(lowerInput, "prod logs") || strings.Contains(lowerInput, "elasticsearch logs") || strings.Contains(lowerInput, "production logs") {
		req.Resource = "prod-logs"
	} else if strings.Contains(lowerInput, "staging-k8s") || strings.Contains(lowerInput, "staging k8s") || strings.Contains(lowerInput, "staging cluster") || strings.Contains(lowerInput, "kubernetes") {
		req.Resource = "staging-k8s"
	} else if strings.Contains(lowerInput, "s3-bucket-analytics") || strings.Contains(lowerInput, "s3 bucket") || strings.Contains(lowerInput, "s3 analytics") || strings.Contains(lowerInput, "s3") {
		req.Resource = "s3-bucket-analytics"
	} else if strings.Contains(lowerInput, "grafana-dashboard") || strings.Contains(lowerInput, "grafana") || strings.Contains(lowerInput, "dashboard") {
		req.Resource = "grafana-dashboard"
	} else {
		req.Resource = "unknown"
	}

	// Permission matching
	if strings.Contains(lowerInput, "admin") || strings.Contains(lowerInput, "root") || strings.Contains(lowerInput, "super") {
		req.Permission = "admin"
	} else if strings.Contains(lowerInput, "write") || strings.Contains(lowerInput, "update") || strings.Contains(lowerInput, "delete") || strings.Contains(lowerInput, "modify") {
		req.Permission = "write"
	} else {
		req.Permission = "read"
	}

	// Duration matching using regex
	durationRegex := regexp.MustCompile(`(\d+)\s*(hour|hr|h|minute|min|m)`)
	matches := durationRegex.FindStringSubmatch(lowerInput)
	if len(matches) >= 3 {
		num := matches[1]
		unit := matches[2]
		if strings.HasPrefix(unit, "h") {
			req.Duration = num + "h"
		} else if strings.HasPrefix(unit, "m") {
			req.Duration = num + "m"
		}
	}

	// Reason matching (look for "to X" or "for Y")
	reasonRegex := regexp.MustCompile(`\b(to|for|investigate|debug|fix)\s+(.*)`)
	reasonMatch := reasonRegex.FindStringSubmatch(userInput)
	if len(reasonMatch) >= 3 {
		req.Reason = reasonMatch[1] + " " + reasonMatch[2]
	} else {
		req.Reason = userInput
	}

	return req
}

// SuggestLeastPrivilege gives alternative recommendations if requested access is too high.
func SuggestLeastPrivilege(resourceID string, permission string, reason string) string {
	if permission == "admin" {
		return fmt.Sprintf("Recommendation: 'write' or 'read' access to %s is sufficient to perform: '%s'. Admin access is restricted for production controls.", resourceID, reason)
	}
	if resourceID == "prod-logs" && permission == "write" {
		return "Recommendation: 'read' access is sufficient. Production Elasticsearch logs do not support write operations."
	}
	return ""
}

// ExplainRegoPolicy converts complex Rego code to plain English.
func ExplainRegoPolicy(regoCode string) string {
	key := getGeminiKey()
	if key != "" {
		prompt := fmt.Sprintf("Explain this Open Policy Agent (Rego) policy in plain English so a developer can understand it easily:\n\n%s", regoCode)
		if text, err := CallGemini(prompt); err == nil {
			return text
		}
	}

	// Local fallback explanation builder
	lines := strings.Split(regoCode, "\n")
	var user, resource, action string
	var riskLimit int = 100

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.Contains(line, "input.user == ") {
			parts := strings.Split(line, "== ")
			if len(parts) > 1 {
				user = strings.Trim(parts[1], `"`+" \t")
			}
		}
		if strings.Contains(line, "input.resource == ") {
			parts := strings.Split(line, "== ")
			if len(parts) > 1 {
				resource = strings.Trim(parts[1], `"`+" \t")
			}
		}
		if strings.Contains(line, "input.action == ") {
			parts := strings.Split(line, "== ")
			if len(parts) > 1 {
				action = strings.Trim(parts[1], `"`+" \t")
			}
		}
		if strings.Contains(line, "input.risk_score <= ") {
			parts := strings.Split(line, "<= ")
			if len(parts) > 1 {
				val, _ := strconv.Atoi(strings.TrimSpace(parts[1]))
				riskLimit = val
			}
		}
	}

	if user != "" && resource != "" && action != "" {
		return fmt.Sprintf("This policy grants user **%s** temporary **%s** access to target **%s**.\nEvaluation checks if the calculated risk score is below **%d/100**.\nIf the risk exceeds this threshold, the request is automatically routed for manual review.", user, action, resource, riskLimit)
	}

	return "OPA Rego policy constraints: Enforces developer profile, permissions checks, and maximum risk threshold parameters for JIT accesses."
}

// RunSecurityChatbot queries DB audits and answers security team questions using NLP.
func RunSecurityChatbot(userQuery string) string {
	if DB == nil {
		return "Database is offline. Unable to query logs."
	}

	var events []AuditEvent
	DB.Order("timestamp desc").Limit(30).Find(&events)

	eventsJSON, _ := json.MarshalIndent(events, "", "  ")

	key := getGeminiKey()
	if key != "" {
		prompt := fmt.Sprintf(`
You are "SecureAccess AI Security Investigator Assistant".
You have access to the last 30 audit log records in JSON format:
%s

User query: "%s"

Analyze the audit log records to answer the user's query precisely. Mention dates, users, resources, and whether access was granted or expired/revoked.
If the query cannot be answered with the provided data, explain what is missing.
`, string(eventsJSON), userQuery)

		if text, err := CallGemini(prompt); err == nil {
			return text
		}
	}

	// Offline local chatbot logic
	log.Println("Using rule-based offline fallback for Security Investigator Chatbot.")
	lowerQuery := strings.ToLower(userQuery)

	if strings.Contains(lowerQuery, "who accessed") || strings.Contains(lowerQuery, "access logs") {
		// Extract resource name if present
		resName := ""
		if strings.Contains(lowerQuery, "prod-db") || strings.Contains(lowerQuery, "database") {
			resName = "prod-db"
		} else if strings.Contains(lowerQuery, "prod-logs") || strings.Contains(lowerQuery, "logs") {
			resName = "prod-logs"
		} else if strings.Contains(lowerQuery, "staging-k8s") || strings.Contains(lowerQuery, "staging") {
			resName = "staging-k8s"
		}

		var filteredEvents []AuditEvent
		if resName != "" {
			DB.Where("resource_id = ? AND action = ?", resName, "access_granted").Order("timestamp desc").Find(&filteredEvents)
		} else {
			DB.Where("action = ?", "access_granted").Order("timestamp desc").Find(&filteredEvents)
		}

		if len(filteredEvents) == 0 {
			return "Checking logs: No records found indicating recent successful grants for that resource in the last 24 hours."
		}

		var b strings.Builder
		b.WriteString("Here is what I found in the audit logs:\n")
		for _, e := range filteredEvents {
			b.WriteString(fmt.Sprintf("- User **%s** was granted access to **%s** on %s. (Status: %s)\n",
				e.User, e.ResourceID, e.Timestamp.Format("Jan 02, 15:04 MST"), e.Status))
		}
		return b.String()
	}

	if strings.Contains(lowerQuery, "revoke") || strings.Contains(lowerQuery, "expired") {
		var revEvents []AuditEvent
		DB.Where("action = ? OR action = ?", "access_revoked", "access_expired").Order("timestamp desc").Find(&revEvents)

		if len(revEvents) == 0 {
			return "Checking logs: No recent revocations or expiration events detected."
		}

		var b strings.Builder
		b.WriteString("Here are recent access revokes/expirations:\n")
		for _, e := range revEvents {
			b.WriteString(fmt.Sprintf("- Access to **%s** for user **%s** was %s at %s.\n",
				e.ResourceID, e.User, e.Action, e.Timestamp.Format("Jan 02, 15:04 MST")))
		}
		return b.String()
	}

	if strings.Contains(lowerQuery, "tamper") || strings.Contains(lowerQuery, "integrity") || strings.Contains(lowerQuery, "security check") {
		report := VerifyLedgerIntegrity()
		if report.Valid {
			return fmt.Sprintf("Ledger check complete: All %d blocks verified successfully. No tamper attempts detected.", report.TotalBlocks)
		} else {
			return fmt.Sprintf("ALERT: Tampering detected! Ledger chain check failed at block %d. Message: %s", *report.TamperedBlock, report.FailureMessage)
		}
	}

	return "I am the AI Security Investigator. I can answer questions like 'Who accessed prod-logs?', 'Show me recent expirations', or perform an 'integrity check' on the audit ledger. Please refine your query."
}
