package model

import "time"

type InstanceRating struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	LicenseEmail string    `gorm:"size:255;not null;index" json:"license_email"`
	UserName     string    `gorm:"size:255;not null" json:"user_name"`
	UserEmail    string    `gorm:"size:255;not null" json:"user_email"`
	UserCount    int64     `json:"user_count"`
	Rating       int       `gorm:"not null" json:"rating"`
	Comment      string    `gorm:"type:text" json:"comment"`
	Version      string    `gorm:"size:50" json:"version"`
	RatedAt      time.Time `gorm:"not null" json:"rated_at"`
	CreatedAt    time.Time `json:"created_at"`
}

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
