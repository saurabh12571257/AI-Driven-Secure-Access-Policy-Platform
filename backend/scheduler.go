package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// StartScheduler starts a background worker that monitors lease durations and auto-revokes access.
func StartScheduler(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	log.Println("Just-in-Time Access Scheduler started. Checking for expired leases every 5s...")

	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				log.Println("JIT Access Scheduler stopped.")
				return
			case <-ticker.C:
				checkExpiredRequests()
			}
		}
	}()
}

func checkExpiredRequests() {
	if DB == nil {
		return
	}

	var expiredRequests []AccessRequest
	now := time.Now()

	// Query requests that are "Active" and whose expires_at timestamp is in the past
	err := DB.Where("status = ? AND expires_at <= ?", "Active", now).Find(&expiredRequests).Error
	if err != nil {
		log.Printf("Scheduler database query failed: %v", err)
		return
	}

	for _, req := range expiredRequests {
		log.Printf("[SCHEDULER] Found expired lease. Request ID: %d, User: %s, Resource: %s",
			req.ID, req.Requester, req.ResourceID)

		// 1. Update request status to "Expired"
		req.Status = "Expired"
		err := DB.Save(&req).Error
		if err != nil {
			log.Printf("Scheduler failed to update request status for ID %d: %v", req.ID, err)
			continue
		}

		// 2. Call Access Manager to remove permissions
		err = RevokeAccess(&req)
		statusStr := "success"
		detailsMap := map[string]interface{}{
			"reason":      "Access duration expired",
			"resource_id": req.ResourceID,
			"revoked_at":  time.Now().Format(time.RFC3339),
		}
		if err != nil {
			statusStr = "failed"
			detailsMap["error"] = err.Error()
			log.Printf("Scheduler failed to revoke infrastructure credentials for ID %d: %v", req.ID, err)
		}

		detailsJSON, _ := json.Marshal(detailsMap)

		// 3. Log event in cryptographic audit ledger
		_, logErr := LogAuditEvent(
			req.ID,
			"SYSTEM",
			req.ResourceID,
			"access_expired",
			statusStr,
			string(detailsJSON),
		)
		if logErr != nil {
			log.Printf("Scheduler failed to append event to audit ledger: %v", logErr)
		}

		fmt.Printf("[SCHEDULER] Successfully processed revocation for request ID %d\n", req.ID)
	}
}
