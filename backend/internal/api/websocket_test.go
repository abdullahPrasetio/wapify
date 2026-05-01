package api

import (
	"testing"
	"time"
	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

func TestHub_Presence(t *testing.T) {
	hub := &Hub{
		Clients: make(map[uint]map[*Client]bool),
		Locks:   make(map[uint]LockInfo),
	}

	client1 := &Client{UserID: 1, UserName: "User 1", TeamID: 1, ActiveRequestID: 101}
	client2 := &Client{UserID: 2, UserName: "User 2", TeamID: 1, ActiveRequestID: 101}

	hub.Register(client1)
	hub.Register(client2)

	hub.mu.RLock()
	clients := hub.Clients[1]
	if len(clients) != 2 {
		t.Errorf("Expected 2 clients in team 1, got %d", len(clients))
	}
	hub.mu.RUnlock()
}

func TestHub_Locking(t *testing.T) {
	hub := &Hub{
		Clients: make(map[uint]map[*Client]bool),
		Locks:   make(map[uint]LockInfo),
	}

	client1 := &Client{UserID: 1, UserName: "User 1", TeamID: 1}
	reqID := uint(101)

	// User 1 locks
	hub.mu.Lock()
	hub.Locks[reqID] = LockInfo{
		UserID:   client1.UserID,
		UserName: client1.UserName,
		ExpireAt: time.Now().Add(5 * time.Second),
	}
	hub.mu.Unlock()

	// Check lock exists
	hub.mu.RLock()
	lock, exists := hub.Locks[reqID]
	if !exists || lock.UserID != 1 {
		t.Errorf("Lock should exist for user 1")
	}
	hub.mu.RUnlock()

	// Test cleanup expired locks
	hub.mu.Lock()
	hub.Locks[reqID] = LockInfo{
		UserID:   client1.UserID,
		UserName: client1.UserName,
		ExpireAt: time.Now().Add(-1 * time.Second), // Expired
	}
	hub.mu.Unlock()

	hub.CleanupExpiredLocks()

	hub.mu.RLock()
	_, exists = hub.Locks[reqID]
	if exists {
		t.Errorf("Lock should have been cleaned up")
	}
	hub.mu.RUnlock()
}

func TestLogActivity(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	teamID := uint(1)
	userID := uint(1)
	action := "CREATED_COLLECTION"
	entityType := "COLLECTION"
	entityID := uint(10)
	details := map[string]interface{}{"name": "Test"}

	mock.ExpectBegin()
	mock.ExpectQuery("^INSERT INTO \"activity_logs\"").
		WithArgs(teamID, userID, action, entityType, entityID, sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	LogActivity(repository.DB, teamID, userID, action, entityType, entityID, details)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBroadcastEntityUpdate(t *testing.T) {
	hub := &Hub{
		Clients: make(map[uint]map[*Client]bool),
		Locks:   make(map[uint]LockInfo),
	}
	
	// No clients registered, should return silently
	hub.BroadcastEntityUpdate(1, "TEAM", 1)
}
