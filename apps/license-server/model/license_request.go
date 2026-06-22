package model

import "time"

type LicenseRequest struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Name       string    `gorm:"size:255;not null" json:"name"`
	Email      string    `gorm:"size:255;not null;index" json:"email"`
	Company    string    `gorm:"size:255" json:"company"`
	Message    string    `gorm:"type:text" json:"message"`
	Status     string    `gorm:"size:50;not null;default:pending;index" json:"status"`
	Duration   string    `gorm:"size:20;not null;default:1year" json:"duration"`
	ValidUntil time.Time `json:"valid_until"`
	LicenseKey string    `gorm:"type:text" json:"license_key,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}
