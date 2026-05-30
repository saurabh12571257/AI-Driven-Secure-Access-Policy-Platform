package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"
)

// CalculateHash generates a SHA-256 signature for a log entry based on its components and the previous block's hash.
func CalculateHash(prevHash string, timestamp time.Time, user string, resourceID string, action string, status string, details string) string {
	payload := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		prevHash,
		timestamp.UTC().Format(time.RFC3339),
		user,
		resourceID,
		action,
		status,
		details,
	)
	h := sha256.New()
	h.Write([]byte(payload))
	return hex.EncodeToString(h.Sum(nil))
}

// LogAuditEvent creates and hashes a new audit entry, appending it to the DB ledger.
func LogAuditEvent(requestID uint, user string, resourceID string, action string, status string, details string) (*AuditEvent, error) {
	if DB == nil {
		return nil, fmt.Errorf("database connection not initialized")
	}

	var lastEvent AuditEvent
	var prevHash string

	// Find the most recent event to link the hash
	result := DB.Order("id desc").First(&lastEvent)
	if result.Error == nil {
		prevHash = lastEvent.Hash
	} else {
		// Genesis block hash (zeros)
		prevHash = "0000000000000000000000000000000000000000000000000000000000000000"
	}

	timestamp := time.Now()
	hash := CalculateHash(prevHash, timestamp, user, resourceID, action, status, details)

	event := AuditEvent{
		RequestID:  requestID,
		Timestamp:  timestamp,
		User:       user,
		ResourceID: resourceID,
		Action:     action,
		Status:     status,
		Hash:       hash,
		PrevHash:   prevHash,
		Details:    details,
	}

	err := DB.Create(&event).Error
	if err != nil {
		return nil, fmt.Errorf("failed to save audit event: %v", err)
	}

	return &event, nil
}

// LedgerIntegrityReport represents the result of the cryptographic ledger review.
type LedgerIntegrityReport struct {
	Valid          bool   `json:"valid"`
	TotalBlocks    int    `json:"total_blocks"`
	TamperedBlock  *int   `json:"tampered_block_id,omitempty"`
	FailureMessage string `json:"failure_message,omitempty"`
}

// VerifyLedgerIntegrity recalculates and verifies the cryptographic links across the whole audit history.
func VerifyLedgerIntegrity() LedgerIntegrityReport {
	if DB == nil {
		return LedgerIntegrityReport{Valid: false, FailureMessage: "Database connection not initialized"}
	}

	var events []AuditEvent
	err := DB.Order("id asc").Find(&events).Error
	if err != nil {
		return LedgerIntegrityReport{Valid: false, FailureMessage: "Failed to read ledger from database: " + err.Error()}
	}

	expectedPrevHash := "0000000000000000000000000000000000000000000000000000000000000000"

	for i, event := range events {
		// 1. Verify link to previous block
		if event.PrevHash != expectedPrevHash {
			idVal := int(event.ID)
			return LedgerIntegrityReport{
				Valid:         false,
				TotalBlocks:   len(events),
				TamperedBlock: &idVal,
				FailureMessage: fmt.Sprintf("Hash linkage broken at block ID %d. Expected prev_hash '%s', found '%s'",
					event.ID, expectedPrevHash, event.PrevHash),
			}
		}

		// 2. Recalculate block hash and compare
		calculatedHash := CalculateHash(event.PrevHash, event.Timestamp, event.User, event.ResourceID, event.Action, event.Status, event.Details)
		if event.Hash != calculatedHash {
			idVal := int(event.ID)
			return LedgerIntegrityReport{
				Valid:         false,
				TotalBlocks:   len(events),
				TamperedBlock: &idVal,
				FailureMessage: fmt.Sprintf("Data tampering detected at block ID %d. Stored hash does not match calculated SHA-256 signature.",
					event.ID),
			}
		}

		// Next block expects current block's hash
		expectedPrevHash = event.Hash
		_ = i
	}

	return LedgerIntegrityReport{
		Valid:       true,
		TotalBlocks: len(events),
	}
}
