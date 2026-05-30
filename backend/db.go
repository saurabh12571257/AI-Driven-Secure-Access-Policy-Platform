package main

import (
	"log"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

// Resource represents a target system engineers can request access to.
type Resource struct {
	ID          string `gorm:"primaryKey" json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`        // database, logs, kubernetes, s3, dashboard
	Environment string `json:"environment"` // production, staging, dev
	DefaultRisk int    `json:"default_risk"` // 0-100 base risk score
	Description string `json:"description"`
}

// AccessRequest represents a JIT access request.
type AccessRequest struct {
	ID              uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	Requester       string     `json:"requester"`
	ResourceID      string     `json:"resource_id"`
	Permission      string     `json:"permission"` // read, write, admin
	Duration        string     `json:"duration"`   // e.g., "2h", "30m"
	DurationSeconds int        `json:"duration_seconds"`
	Reason          string     `json:"reason"`
	RiskScore       int        `json:"risk_score"`
	RiskLevel       string     `json:"risk_level"`       // Low, Medium, High
	RiskAssessment  string     `json:"risk_assessment"`  // JSON breakdown of risk evaluation
	Status          string     `json:"status"`           // Pending Approval, Approved, Denied, Active, Expired, Revoked
	OpaPolicy       string     `json:"opa_policy"`       // Generated Rego code
	ApprovedBy      string     `json:"approved_by,omitempty"`
	DeniedReason    string     `json:"denied_reason,omitempty"`
	RequestedAt     time.Time  `json:"requested_at"`
	ApprovedAt      *time.Time `json:"approved_at,omitempty"`
	ExpiresAt       *time.Time `json:"expires_at,omitempty"`
}

// AuditEvent represents a single immutable record in the tamper-evident chain.
type AuditEvent struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	RequestID  uint      `json:"request_id"`
	Timestamp  time.Time `json:"timestamp"`
	User       string    `json:"user"`
	ResourceID string    `json:"resource_id"`
	Action     string    `json:"action"` // request_created, manager_approved, access_granted, access_revoked, etc.
	Status     string    `json:"status"` // success, failed, tampered
	Hash       string    `json:"hash"`
	PrevHash   string    `json:"prev_hash"`
	Details    string    `json:"details"` // Additional metadata JSON
}

// SystemHealthStatus represents health statuses of dependencies.
type SystemHealthStatus struct {
	PolicyEngine string `json:"policy_engine"` // Healthy, Unhealthy
	Vault        string `json:"vault"`
	Keycloak     string `json:"keycloak"`
	AuditService string `json:"audit_service"`
	AIService    string `json:"ai_service"`
	Database     string `json:"database"`
}

// InitDB initializes the SQLite database and runs migrations.
func InitDB(dbPath string) {
	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto Migrate the schemas
	err = DB.AutoMigrate(&Resource{}, &AccessRequest{}, &AuditEvent{})
	if err != nil {
		log.Fatalf("Failed to run database migrations: %v", err)
	}

	// Seed default resources if the table is empty
	var count int64
	DB.Model(&Resource{}).Count(&count)
	if count == 0 {
		seedResources()
	}
}

func seedResources() {
	defaultResources := []Resource{
		{
			ID:          "prod-db",
			Name:        "Production Database",
			Type:        "database",
			Environment: "production",
			DefaultRisk: 80,
			Description: "Main PostgreSQL relational database containing user credentials and payment logs.",
		},
		{
			ID:          "prod-logs",
			Name:        "Production Elasticsearch Logs",
			Type:        "logs",
			Environment: "production",
			DefaultRisk: 40,
			Description: "Log aggregator containing real-time application and system logs for checkout services.",
		},
		{
			ID:          "staging-k8s",
			Name:        "Staging Kubernetes Cluster",
			Type:        "kubernetes",
			Environment: "staging",
			DefaultRisk: 15,
			Description: "Staging cluster (EKS) for deploying preview branch containers and automated integrations.",
		},
		{
			ID:          "s3-bucket-analytics",
			Name:        "S3 Analytics Bucket",
			Type:        "s3",
			Environment: "production",
			DefaultRisk: 30,
			Description: "S3 storage containing read-only aggregated business and platform analytics snapshots.",
		},
		{
			ID:          "grafana-dashboard",
			Name:        "Internal Grafana Dashboards",
			Type:        "dashboard",
			Environment: "production",
			DefaultRisk: 5,
			Description: "Read-only metrics dashboard for monitoring CPU, memory, and database connection pools.",
		},
	}

	for _, res := range defaultResources {
		DB.Create(&res)
	}
	log.Println("Seeded default resources successfully.")
}
