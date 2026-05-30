package main

import (
	"fmt"
	"log"
)

// GrantAccess simulates configuring permissions on targeted cloud/infrastructure resources.
func GrantAccess(req *AccessRequest) (string, error) {
	log.Printf("[ACCESS GRANTED] Granting '%s' access on '%s' to '%s' for '%s'",
		req.Permission, req.ResourceID, req.Requester, req.Duration)

	var accessPayload string

	switch req.ResourceID {
	case "prod-db":
		// Database dynamic user setup
		tempUser := fmt.Sprintf("jit_%d_db", req.ID)
		accessPayload = fmt.Sprintf(`{
  "host": "postgresql-prod.internal.corp",
  "port": 5432,
  "database": "prod_users",
  "username": "%s",
  "password": "dynamic_secret_password_token",
  "valid_until": "%s",
  "roles": ["db_read"]
}`, tempUser, req.ExpiresAt.Format("2006-01-02 15:04:05 UTC"))

	case "staging-k8s":
		// Kubernetes Namespace RBAC Binding
		accessPayload = fmt.Sprintf(`apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: jit-binding-%d
  namespace: default
subjects:
- kind: User
  name: %s
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: developer-readonly
  apiGroup: rbac.authorization.k8s.io`, req.ID, req.Requester)

	case "prod-logs":
		// Elastic IAM credentials
		accessPayload = fmt.Sprintf(`{
  "api_endpoint": "https://elasticsearch-prod.corp:9200",
  "token_type": "Bearer",
  "token": "vault:token:elastic-prod-%d-read-only-access-key",
  "expires_at": "%s"
}`, req.ID, req.ExpiresAt.Format("2006-01-02 15:04:05 UTC"))

	case "s3-bucket-analytics":
		// AWS dynamic STS Role
		accessPayload = fmt.Sprintf(`{
  "aws_access_key_id": "ASIAW834NDKJSKD%d",
  "aws_secret_access_key": "xS28n3hDJsj9284NDKskdjnS08nS",
  "aws_session_token": "IQoJb3JpZ2luX2VjEBsY...",
  "role_arn": "arn:aws:iam::123456789012:role/JITS3AnalyticsRead",
  "expiration": "%s"
}`, req.ID, req.ExpiresAt.Format("2006-01-02 15:04:05 UTC"))

	case "grafana-dashboard":
		// Temporary dashboard JWT token
		accessPayload = fmt.Sprintf(`{
  "grafana_url": "https://grafana.internal.corp/d/checkout-latency",
  "viewer_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.jit-grafana-session-%d",
  "valid_until": "%s"
}`, req.ID, req.ExpiresAt.Format("2006-01-02 15:04:05 UTC"))

	default:
		accessPayload = fmt.Sprintf(`{
  "status": "granted",
  "resource": "%s",
  "permission": "%s",
  "expires_at": "%s"
}`, req.ResourceID, req.Permission, req.ExpiresAt.Format("2006-01-02 15:04:05 UTC"))
	}

	return accessPayload, nil
}

// RevokeAccess simulates removing permissions on targeted cloud/infrastructure resources.
func RevokeAccess(req *AccessRequest) error {
	log.Printf("[ACCESS REVOKED] Revoking '%s' access on '%s' from '%s'",
		req.Permission, req.ResourceID, req.Requester)

	// In a real application, we would execute API calls to Vault/K8s/AWS to purge these.
	// For instance, executing Kube API client to delete the RoleBinding:
	// clientset.RbacV1().RoleBindings("default").Delete(context.TODO(), "jit-binding-X", metav1.DeleteOptions{})

	return nil
}
