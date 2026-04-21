package api

import (
	"testing"
	"time"
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

	// Simulating broadcast presence check
	// (Since writing to websocket.Conn requires a real connection, we skip the WriteMessage part in unit tests 
	// or mock it. For now we just check the internal state logic).
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
