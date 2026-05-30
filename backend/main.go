package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func main() {
	// 1. Initialize SQLite Database
	InitDB("secureaccess.db")
	log.Println("SQLite database initialized at secureaccess.db")

	// 2. Start JIT Access Expire Scheduler
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	StartScheduler(ctx)

	// 3. Define HTTP Handlers
	mux := http.NewServeMux()

	mux.HandleFunc("/api/resources", handleResources)
	mux.HandleFunc("/api/request/parse", handleRequestParse)
	mux.HandleFunc("/api/request/submit", handleRequestSubmit)
	mux.HandleFunc("/api/requests", handleRequestsList)
	mux.HandleFunc("/api/requests/approve", handleRequestApprove)
	mux.HandleFunc("/api/audit/logs", handleAuditLogs)
	mux.HandleFunc("/api/audit/verify", handleAuditVerify)
	mux.HandleFunc("/api/audit/tamper", handleAuditTamper)
	mux.HandleFunc("/api/security/investigate", handleSecurityInvestigate)
	mux.HandleFunc("/api/policy/explain", handlePolicyExplain)
	mux.HandleFunc("/api/health", handleHealth)

	// 4. Run HTTP Server with CORS Middleware
	handler := corsMiddleware(mux)
	port := ":8080"
	log.Printf("SecureAccess Go Backend listening on http://localhost%s", port)
	if err := http.ListenAndServe(port, handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

// corsMiddleware injects HTTP headers enabling Next.js UI integration.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func parseDurationToSeconds(d string) int {
	d = strings.ToLower(strings.TrimSpace(d))
	if len(d) == 0 {
		return 3600
	}
	if strings.HasSuffix(d, "h") {
		valStr := strings.TrimSuffix(d, "h")
		val, err := strconv.Atoi(valStr)
		if err == nil {
			return val * 3600
		}
	}
	if strings.HasSuffix(d, "m") {
		valStr := strings.TrimSuffix(d, "m")
		val, err := strconv.Atoi(valStr)
		if err == nil {
			return val * 60
		}
	}
	dur, err := time.ParseDuration(d)
	if err == nil {
		return int(dur.Seconds())
	}
	return 3600
}

func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"error": message})
}

func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, _ := json.Marshal(payload)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

// GET /api/resources
func handleResources(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondWithError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var resources []Resource
	if err := DB.Find(&resources).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondWithJSON(w, http.StatusOK, resources)
}

// POST /api/request/parse
type ParseInput struct {
	Prompt string `json:"prompt"`
}

func handleRequestParse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondWithError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var in ParseInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid input payload")
		return
	}

	// 1. Run AI NLP Parsing
	parsed := ParseAccessRequest(in.Prompt)

	// Fetch target resource details
	var res Resource
	err := DB.Where("id = ?", parsed.Resource).First(&res).Error
	if err != nil {
		// Fallback resource configuration if NLP found unknown tag
		res = Resource{
			ID:          "prod-db",
			Name:        "Production Database",
			Type:        "database",
			Environment: "production",
			DefaultRisk: 80,
		}
		parsed.Resource = "prod-db"
	}

	// 2. Perform Risk Evaluation
	durationSecs := parseDurationToSeconds(parsed.Duration)
	riskScore, riskLevel, riskBreakdown, approvalPath := EvaluateRisk("saurabh@example.com", res, parsed.Permission, durationSecs, parsed.Reason)

	// 3. Generate Rego policy code
	regoCode := GenerateRego("saurabh@example.com", parsed.Resource, parsed.Permission, riskScore)

	// 4. Generate Least Privilege Suggestion
	lpSuggestion := SuggestLeastPrivilege(parsed.Resource, parsed.Permission, parsed.Reason)

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"parsed":              parsed,
		"risk_score":          riskScore,
		"risk_level":          riskLevel,
		"risk_assessment":     riskBreakdown,
		"approval_path":       approvalPath,
		"opa_policy":          regoCode,
		"least_privilege_suggestion": lpSuggestion,
	})
}

// POST /api/request/submit
type SubmitInput struct {
	Requester  string `json:"requester"`
	ResourceID string `json:"resource_id"`
	Permission string `json:"permission"`
	Duration   string `json:"duration"`
	Reason     string `json:"reason"`
}

func handleRequestSubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondWithError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var in SubmitInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid input payload")
		return
	}

	// Fetch resource risk configs
	var res Resource
	if err := DB.Where("id = ?", in.ResourceID).First(&res).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Target resource config not found")
		return
	}

	// Evaluate Risk
	durSecs := parseDurationToSeconds(in.Duration)
	riskScore, riskLevel, riskBreakdown, _ := EvaluateRisk(in.Requester, res, in.Permission, durSecs, in.Reason)

	// Compile policy
	regoCode := GenerateRego(in.Requester, in.ResourceID, in.Permission, riskScore)

	// Evaluate with embedded OPA
	allowed, opaMessage, err := EvaluatePolicy(context.Background(), regoCode, in.Requester, in.ResourceID, in.Permission, riskScore)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "OPA evaluation error: "+err.Error())
		return
	}

	status := "Pending Approval"
	// Automatic approval condition based on risk threshold and OPA allowance
	if riskScore <= 30 && allowed {
		status = "Active"
	} else if !allowed {
		status = "Denied"
	}

	now := time.Now()
	var expiresAt *time.Time
	var approvedAt *time.Time
	var approvedBy string

	if status == "Active" {
		exp := now.Add(time.Duration(durSecs) * time.Second)
		expiresAt = &exp
		approvedAt = &now
		approvedBy = "SYSTEM (Auto-Approved)"
	}

	request := AccessRequest{
		Requester:       in.Requester,
		ResourceID:      in.ResourceID,
		Permission:      in.Permission,
		Duration:        in.Duration,
		DurationSeconds: durSecs,
		Reason:          in.Reason,
		RiskScore:       riskScore,
		RiskLevel:       riskLevel,
		RiskAssessment:  riskBreakdown,
		Status:          status,
		OpaPolicy:       regoCode,
		RequestedAt:     now,
		ApprovedAt:      approvedAt,
		ExpiresAt:       expiresAt,
		ApprovedBy:      approvedBy,
	}

	if status == "Denied" {
		request.DeniedReason = "OPA Policy Violation: " + opaMessage
	}

	if err := DB.Create(&request).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to submit request: "+err.Error())
		return
	}

	// 1. Audit log: Request Created
	detailsJSON, _ := json.Marshal(map[string]interface{}{
		"risk_score": riskScore,
		"reason":     in.Reason,
		"status":     status,
	})
	LogAuditEvent(request.ID, in.Requester, in.ResourceID, "request_created", "success", string(detailsJSON))

	// 2. Grant and Audit if Auto-Approved
	if status == "Active" {
		creds, grantErr := GrantAccess(&request)
		grantStatus := "success"
		grantDetails := map[string]interface{}{
			"action": "auto_grant",
		}
		if grantErr != nil {
			grantStatus = "failed"
			grantDetails["error"] = grantErr.Error()
		} else {
			grantDetails["credentials_mock"] = creds
		}
		grantJSON, _ := json.Marshal(grantDetails)
		LogAuditEvent(request.ID, "SYSTEM", in.ResourceID, "access_granted", grantStatus, string(grantJSON))
	} else if status == "Denied" {
		LogAuditEvent(request.ID, "SYSTEM", in.ResourceID, "access_denied", "success", "OPA Policy violation: "+opaMessage)
	}

	respondWithJSON(w, http.StatusCreated, request)
}

// GET /api/requests
func handleRequestsList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondWithError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var list []AccessRequest
	if err := DB.Order("requested_at desc").Find(&list).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondWithJSON(w, http.StatusOK, list)
}

// POST /api/requests/approve
type ApproveInput struct {
	ID           uint   `json:"id"`
	ApprovedBy   string `json:"approved_by"` // manager, security_admin
	Action       string `json:"action"`      // approve, deny
	DeniedReason string `json:"denied_reason,omitempty"`
}

func handleRequestApprove(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondWithError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var in ApproveInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid input payload")
		return
	}

	var req AccessRequest
	if err := DB.First(&req, in.ID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Request not found")
		return
	}

	if req.Status != "Pending Approval" {
		respondWithError(w, http.StatusBadRequest, "Request is not in a pending state")
		return
	}

	now := time.Now()

	if in.Action == "deny" {
		req.Status = "Denied"
		req.DeniedReason = in.DeniedReason
		if err := DB.Save(&req).Error; err != nil {
			respondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		LogAuditEvent(req.ID, in.ApprovedBy, req.ResourceID, "request_denied", "success", "Manual review denial: "+in.DeniedReason)
		respondWithJSON(w, http.StatusOK, req)
		return
	}

	// Approve logic
	req.Status = "Active"
	req.ApprovedBy = in.ApprovedBy
	req.ApprovedAt = &now
	exp := now.Add(time.Duration(req.DurationSeconds) * time.Second)
	req.ExpiresAt = &exp

	if err := DB.Save(&req).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	LogAuditEvent(req.ID, in.ApprovedBy, req.ResourceID, "manager_approved", "success", "Manual request approved by "+in.ApprovedBy)

	// Trigger infra credentials access config
	creds, grantErr := GrantAccess(&req)
	grantStatus := "success"
	grantDetails := map[string]interface{}{
		"action": "manual_grant",
	}
	if grantErr != nil {
		grantStatus = "failed"
		grantDetails["error"] = grantErr.Error()
	} else {
		grantDetails["credentials_mock"] = creds
	}
	grantJSON, _ := json.Marshal(grantDetails)
	LogAuditEvent(req.ID, "SYSTEM", req.ResourceID, "access_granted", grantStatus, string(grantJSON))

	respondWithJSON(w, http.StatusOK, req)
}

// GET /api/audit/logs
func handleAuditLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondWithError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var logs []AuditEvent
	if err := DB.Order("timestamp desc").Find(&logs).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondWithJSON(w, http.StatusOK, logs)
}

// POST /api/audit/verify
func handleAuditVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondWithError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	report := VerifyLedgerIntegrity()
	respondWithJSON(w, http.StatusOK, report)
}

// POST /api/audit/tamper
type TamperInput struct {
	ID        uint   `json:"id"`
	FieldName string `json:"field_name"` // user, details, hash
	Value     string `json:"value"`
}

func handleAuditTamper(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondWithError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var in TamperInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid input payload")
		return
	}

	var event AuditEvent
	if err := DB.First(&event, in.ID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Audit block not found")
		return
	}

	// Developer action simulating a SQL breach to bypass blockchain audit integrity
	switch in.FieldName {
	case "user":
		event.User = in.Value
	case "details":
		event.Details = in.Value
	case "hash":
		event.Hash = in.Value
	default:
		respondWithError(w, http.StatusBadRequest, "Unknown field to modify")
		return
	}

	event.Status = "tampered"
	if err := DB.Save(&event).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Block successfully corrupted. Try verifying ledger integrity to test tamper detection.",
		"block":   event,
	})
}

// POST /api/security/investigate
type InvestigateInput struct {
	Query string `json:"query"`
}

func handleSecurityInvestigate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondWithError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var in InvestigateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid input payload")
		return
	}

	answer := RunSecurityChatbot(in.Query)
	respondWithJSON(w, http.StatusOK, map[string]string{"answer": answer})
}

// POST /api/policy/explain
type ExplainInput struct {
	RegoCode string `json:"rego_code"`
}

func handlePolicyExplain(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondWithError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var in ExplainInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid input payload")
		return
	}

	explanation := ExplainRegoPolicy(in.RegoCode)
	respondWithJSON(w, http.StatusOK, map[string]string{"explanation": explanation})
}

// GET /api/health
func handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondWithError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Evaluate status of platform services
	status := SystemHealthStatus{
		PolicyEngine: "Healthy",
		Vault:        "Healthy",
		Keycloak:     "Healthy",
		AuditService: "Healthy",
		Database:     "Healthy",
	}

	// Check if Gemini API key is loaded
	if getGeminiKey() == "" {
		status.AIService = "Healthy (Local Fallback NLP Active)"
	} else {
		status.AIService = "Healthy (Gemini Pro Active)"
	}

	// Recalculate blockchain hashes to verify audit logger integrity
	report := VerifyLedgerIntegrity()
	if !report.Valid {
		status.AuditService = "Anomalous (Cryptographic chain broken)"
	}

	respondWithJSON(w, http.StatusOK, status)
}
