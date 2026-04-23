package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"os"

	"github.com/waluyo/wapify-backend/internal/repository"
)

// SyncUserSignatures ensures all existing users have a valid integrity signature.
func SyncUserSignatures() {
	var users []repository.User
	if err := repository.DB.Find(&users).Error; err != nil {
		log.Printf("Error fetching users for signature sync: %v", err)
		return
	}

	for _, u := range users {
		if u.RoleSignature == "" {
			sig := CalculateRoleSignature(u.ID, u.Email, u.IsSuperAdmin)
			repository.DB.Model(&u).Update("role_signature", sig)
		}
	}
	log.Println("Integrity System: User signatures synchronized.")
}

// CalculateRoleSignature creates a cryptographic hash of user role data to prevent DB tampering.
func CalculateRoleSignature(userID uint, email string, isSuperAdmin bool) string {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "default_secret_fallback"
	}
	data := fmt.Sprintf("%d:%s:%v", userID, email, isSuperAdmin)
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

func parseUint(s string) uint {
	var n uint
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + uint(c-'0')
		}
	}
	return n
}
