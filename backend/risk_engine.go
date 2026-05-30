package main

import (
	"encoding/json"
	"strings"
	"time"
)

// RiskBreakdown holds specific criteria items evaluated by the engine.
type RiskBreakdown struct {
	BaseRisk           int    `json:"base_risk"`
	PermissionModifier int    `json:"permission_modifier"`
	DurationModifier   int    `json:"duration_modifier"`
	ReasonModifier     int    `json:"reason_modifier"`
	AnomalyModifier    int    `json:"anomaly_modifier"`
	Explanation        string `json:"explanation"`
}

// EvaluateRisk calculates a risk score from 0-100 and returns a JSON assessment breakdown and the level.
func EvaluateRisk(requester string, resource Resource, permission string, durationSecs int, reason string) (int, string, string, string) {
	var breakdown RiskBreakdown
	breakdown.BaseRisk = resource.DefaultRisk

	// 1. Permission Modifier
	switch strings.ToLower(permission) {
	case "admin":
		breakdown.PermissionModifier = 20
	case "write":
		breakdown.PermissionModifier = 10
	case "read":
		breakdown.PermissionModifier = 0
	default:
		breakdown.PermissionModifier = 5
	}

	// 2. Duration Modifier
	hours := float64(durationSecs) / 3600.0
	if hours <= 1.0 {
		breakdown.DurationModifier = -5
	} else if hours <= 4.0 {
		breakdown.DurationModifier = 0
	} else if hours <= 8.0 {
		breakdown.DurationModifier = 10
	} else {
		breakdown.DurationModifier = 25
	}

	// 3. Reason Modifier
	trimmedReason := strings.TrimSpace(reason)
	if len(trimmedReason) == 0 {
		breakdown.ReasonModifier = 15
	} else if len(trimmedReason) < 10 {
		breakdown.ReasonModifier = 5
	} else {
		// Legitimate keywords indicating active engineering troubleshooting decrease suspicion slightly
		lowerReason := strings.ToLower(trimmedReason)
		if strings.Contains(lowerReason, "fix") || strings.Contains(lowerReason, "debug") || strings.Contains(lowerReason, "incident") || strings.Contains(lowerReason, "checkout") {
			breakdown.ReasonModifier = -5
		} else {
			breakdown.ReasonModifier = 0
		}
	}

	// 4. Anomaly detection (Historical DB check)
	var totalRequestsToday int64
	var sameResourceToday int64
	yesterday := time.Now().Add(-24 * time.Hour)

	if DB != nil {
		DB.Model(&AccessRequest{}).Where("requester = ? AND requested_at > ?", requester, yesterday).Count(&totalRequestsToday)
		DB.Model(&AccessRequest{}).Where("requester = ? AND resource_id = ? AND requested_at > ?", requester, resource.ID, yesterday).Count(&sameResourceToday)
	}

	if totalRequestsToday >= 5 {
		breakdown.AnomalyModifier += 15
	}
	if sameResourceToday >= 3 {
		breakdown.AnomalyModifier += 20
	}

	// Calculate Final Score
	score := breakdown.BaseRisk + breakdown.PermissionModifier + breakdown.DurationModifier + breakdown.ReasonModifier + breakdown.AnomalyModifier

	// Boundaries
	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}

	// Risk Level and Routing
	var riskLevel string
	var approvalPath string
	if score <= 30 {
		riskLevel = "Low"
		approvalPath = "Auto-Approved"
	} else if score <= 70 {
		riskLevel = "Medium"
		approvalPath = "Manager Approval"
	} else {
		riskLevel = "High"
		approvalPath = "Security Admin Approval"
	}

	// Narrative Explanation
	explanations := []string{}
	explanations = append(explanations, resource.Name+" in "+resource.Environment+" environment has a base risk of "+string(rune(resource.DefaultRisk))+"%.")
	if breakdown.PermissionModifier > 0 {
		explanations = append(explanations, "Requested elevated permission level '"+permission+"' added "+string(rune(breakdown.PermissionModifier))+" risk points.")
	}
	if breakdown.DurationModifier > 0 {
		explanations = append(explanations, "Request duration exceeds standard window (duration: "+durationDesc(hours)+"), adding "+string(rune(breakdown.DurationModifier))+" risk points.")
	}
	if breakdown.ReasonModifier > 0 {
		explanations = append(explanations, "Weak justification or brief description provided.")
	}
	if breakdown.AnomalyModifier > 0 {
		explanations = append(explanations, "Anomaly Alert: Multiple requests detected for this user in the last 24 hours (Count: "+string(rune(totalRequestsToday))+").")
	}

	breakdown.Explanation = strings.Join(explanations, " ")
	if len(breakdown.Explanation) == 0 {
		breakdown.Explanation = "Standard low-risk access request."
	}

	assessmentJSON, _ := json.Marshal(breakdown)

	return score, riskLevel, string(assessmentJSON), approvalPath
}

func durationDesc(hours float64) string {
	if hours >= 24 {
		return "24h+"
	}
	if hours > 1 {
		return "long-lived"
	}
	return "short-lived"
}
