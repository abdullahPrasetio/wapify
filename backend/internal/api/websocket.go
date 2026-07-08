package api

import (
	"encoding/json"
	"log"
	"strconv"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapbolt-backend/internal/repository"
	"gorm.io/gorm"
)

const (
	wsWriteWait  = 10 * time.Second
	wsPongWait   = 60 * time.Second
	wsPingPeriod = (wsPongWait * 9) / 10 // must stay below wsPongWait
)

// WSEventType defines the type of websocket event
type WSEventType string

const (
	EventJoinRequest  WSEventType = "JOIN_REQUEST"
	EventLeaveRequest WSEventType = "LEAVE_REQUEST"
	EventLockRequest  WSEventType = "LOCK_REQUEST"
	EventUnlockRequest WSEventType = "UNLOCK_REQUEST"
	EventPresenceUpdate WSEventType = "PRESENCE_UPDATE"
	EventLockUpdate   WSEventType = "LOCK_UPDATE"
	EventEntityUpdated WSEventType = "ENTITY_UPDATED"
	EventDonationPrompt WSEventType = "DONATION_PROMPT"
	EventNotificationNew WSEventType = "NOTIFICATION_NEW"
)

// WSEvent represents the structure of messages exchanged via websocket
type WSEvent struct {
	Type      WSEventType `json:"type"`
	RequestID uint        `json:"request_id,omitempty"`
	Payload   interface{} `json:"payload,omitempty"`
}

type LockInfo struct {
	UserID   uint      `json:"user_id"`
	UserName string    `json:"user_name"`
	ExpireAt time.Time `json:"-"`
}

type UserPresence struct {
	UserID   uint   `json:"user_id"`
	UserName string `json:"user_name"`
}

// Client represents a connected websocket client
type Client struct {
	mu              sync.Mutex
	Conn            *websocket.Conn
	UserID          uint
	UserName        string
	TeamID          uint
	ActiveRequestID uint // 0 if not focusing on any request
}

func (c *Client) WriteMessage(messageType int, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Conn.SetWriteDeadline(time.Now().Add(wsWriteWait))
	return c.Conn.WriteMessage(messageType, data)
}


// Hub manages websocket connections and states
type Hub struct {
	mu sync.RWMutex
	// TeamID -> Clients
	Clients map[uint]map[*Client]bool
	// RequestID -> LockInfo
	Locks map[uint]LockInfo
}

var WSHub = &Hub{
	Clients: make(map[uint]map[*Client]bool),
	Locks:   make(map[uint]LockInfo),
}

// SetupWebSocketRoutes configures the websocket endpoints
func SetupWebSocketRoutes(router fiber.Router) {
	// Middleware to check if the request is for an upgrade
	router.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	// The actual websocket handler
	router.Get("/ws", websocket.New(func(c *websocket.Conn) {
		// Get queries (we could also use JWT from query or header)
		userIDStr := c.Query("user_id")
		userName := c.Query("user_name")
		teamIDStr := c.Query("team_id")

		userID, _ := strconv.ParseUint(userIDStr, 10, 32)
		teamID, _ := strconv.ParseUint(teamIDStr, 10, 32)

		if userID == 0 || teamID == 0 {
			c.Close()
			return
		}

		client := &Client{
			Conn:     c,
			UserID:   uint(userID),
			UserName: userName,
			TeamID:   uint(teamID),
		}

		WSHub.Register(client)
		defer WSHub.Unregister(client)

		// Real WS-level keep-alive: a proxy/load-balancer sitting in front of
		// the backend may drop connections it considers idle, and app-level
		// JSON "PING" messages from the client aren't always recognized as
		// activity by such proxies. Native ping/pong control frames are.
		// This also lets us reap dead connections (e.g. laptop sleep, network
		// drop without a clean close) instead of leaving them registered forever.
		_ = c.SetReadDeadline(time.Now().Add(wsPongWait))
		c.SetPongHandler(func(string) error {
			return c.SetReadDeadline(time.Now().Add(wsPongWait))
		})

		done := make(chan struct{})
		defer close(done)
		go func() {
			ticker := time.NewTicker(wsPingPeriod)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
					if err := client.WriteMessage(websocket.PingMessage, nil); err != nil {
						return
					}
				case <-done:
					return
				}
			}
		}()

		// Listen for messages
		for {
			_, msg, err := c.ReadMessage()
			if err != nil {
				if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
					log.Println("WS read error:", err)
				}
				break
			}

			var event WSEvent
			if err := json.Unmarshal(msg, &event); err != nil {
				continue
			}

			WSHub.HandleEvent(client, event)
		}
	}))

	// Start a goroutine to clean up expired locks every second
	go func() {
		for {
			time.Sleep(1 * time.Second)
			WSHub.CleanupExpiredLocks()
		}
	}()
}

func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.Clients[client.TeamID] == nil {
		h.Clients[client.TeamID] = make(map[*Client]bool)
	}
	h.Clients[client.TeamID][client] = true
	log.Printf("WS: Client Registered - UserID: %d, TeamID: %d, Total Clients in Team: %d", client.UserID, client.TeamID, len(h.Clients[client.TeamID]))
}

func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	if h.Clients[client.TeamID] != nil {
		delete(h.Clients[client.TeamID], client)
		log.Printf("WS: Client Unregistered - UserID: %d, TeamID: %d, Clients left in Team: %d", client.UserID, client.TeamID, len(h.Clients[client.TeamID]))
	}
	
	// If the user had a lock, release it
	for reqID, lock := range h.Locks {
		if lock.UserID == client.UserID {
			delete(h.Locks, reqID)
			// Need to broadcast unlock, do it outside lock to avoid deadlock
			go h.BroadcastLockUpdate(client.TeamID, reqID)
		}
	}
	
	oldReqID := client.ActiveRequestID
	h.mu.Unlock()

	if oldReqID != 0 {
		h.BroadcastPresence(client.TeamID, oldReqID)
	}
}

func (h *Hub) HandleEvent(client *Client, event WSEvent) {
	switch event.Type {
	case EventJoinRequest:
		h.mu.Lock()
		oldReqID := client.ActiveRequestID
		client.ActiveRequestID = event.RequestID
		h.mu.Unlock()

		if oldReqID != 0 && oldReqID != event.RequestID {
			h.BroadcastPresence(client.TeamID, oldReqID)
		}
		h.BroadcastPresence(client.TeamID, event.RequestID)

		// Send current lock status for this request to the client
		h.SendLockStatus(client, event.RequestID)

	case EventLeaveRequest:
		h.mu.Lock()
		oldReqID := client.ActiveRequestID
		client.ActiveRequestID = 0
		h.mu.Unlock()

		if oldReqID != 0 {
			h.BroadcastPresence(client.TeamID, oldReqID)
		}

	case EventLockRequest:
		h.mu.Lock()
		lock, exists := h.Locks[event.RequestID]
		now := time.Now()
		success := false

		// Can lock if it's not locked, or lock has expired, or we already own the lock
		if !exists || now.After(lock.ExpireAt) || lock.UserID == client.UserID {
			h.Locks[event.RequestID] = LockInfo{
				UserID:   client.UserID,
				UserName: client.UserName,
				ExpireAt: now.Add(5 * time.Second), // TTL 5 seconds
			}
			success = true
		}
		h.mu.Unlock()

		if success {
			h.BroadcastLockUpdate(client.TeamID, event.RequestID)
		}

	case "PING":
		msg, _ := json.Marshal(WSEvent{Type: "PONG"})
		client.WriteMessage(websocket.TextMessage, msg)
		return
	case EventUnlockRequest:
		h.mu.Lock()
		lock, exists := h.Locks[event.RequestID]
		success := false
		if exists && lock.UserID == client.UserID {
			delete(h.Locks, event.RequestID)
			success = true
		}
		h.mu.Unlock()

		if success {
			h.BroadcastLockUpdate(client.TeamID, event.RequestID)
		}
	}
}

func (h *Hub) BroadcastPresence(teamID uint, requestID uint) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if h.Clients[teamID] == nil {
		return
	}

	// Find all users focusing on this request
	var presence []UserPresence
	seen := make(map[uint]bool) // Deduplicate if a user has multiple tabs/connections

	for c := range h.Clients[teamID] {
		if c.ActiveRequestID == requestID && !seen[c.UserID] {
			presence = append(presence, UserPresence{
				UserID:   c.UserID,
				UserName: c.UserName,
			})
			seen[c.UserID] = true
		}
	}

	event := WSEvent{
		Type:      EventPresenceUpdate,
		RequestID: requestID,
		Payload:   presence,
	}
	
	msg, _ := json.Marshal(event)

	// Broadcast to everyone in the team
	for c := range h.Clients[teamID] {
		c.WriteMessage(websocket.TextMessage, msg)
	}
}

func (h *Hub) BroadcastLockUpdate(teamID uint, requestID uint) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if h.Clients[teamID] == nil {
		return
	}

	lock, exists := h.Locks[requestID]
	var payload interface{} = nil
	if exists && time.Now().Before(lock.ExpireAt) {
		payload = map[string]interface{}{
			"user_id":   lock.UserID,
			"user_name": lock.UserName,
		}
	}

	event := WSEvent{
		Type:      EventLockUpdate,
		RequestID: requestID,
		Payload:   payload, // nil if unlocked
	}
	msg, _ := json.Marshal(event)

	for c := range h.Clients[teamID] {
		c.WriteMessage(websocket.TextMessage, msg)
	}
}

func (h *Hub) SendLockStatus(client *Client, requestID uint) {
	h.mu.RLock()
	lock, exists := h.Locks[requestID]
	h.mu.RUnlock()

	var payload interface{} = nil
	if exists && time.Now().Before(lock.ExpireAt) {
		payload = map[string]interface{}{
			"user_id":   lock.UserID,
			"user_name": lock.UserName,
		}
	}

	event := WSEvent{
		Type:      EventLockUpdate,
		RequestID: requestID,
		Payload:   payload,
	}
	msg, _ := json.Marshal(event)
	client.WriteMessage(websocket.TextMessage, msg)
}

func (h *Hub) CleanupExpiredLocks() {
	h.mu.Lock()
	now := time.Now()
	expiredReqIDs := make([]uint, 0)
	
	for reqID, lock := range h.Locks {
		if now.After(lock.ExpireAt) {
			delete(h.Locks, reqID)
			expiredReqIDs = append(expiredReqIDs, reqID)
		}
	}
	h.mu.Unlock()

	// Broadcast unlocks for expired locks
	for _, reqID := range expiredReqIDs {
		// To properly broadcast, we'd need the team_id. 
		// For simplicity, we could store TeamID in LockInfo, but we can also broadcast to ALL teams (inefficient but works for MVP).
		// Let's iterate all teams.
		h.mu.RLock()
		teams := make([]uint, 0, len(h.Clients))
		for teamID := range h.Clients {
			teams = append(teams, teamID)
		}
		h.mu.RUnlock()
		
		for _, teamID := range teams {
			h.BroadcastLockUpdate(teamID, reqID)
		}
	}
}

// BroadcastEntityUpdate is called from HTTP handlers when a request/folder/collection is modified
func (h *Hub) BroadcastEntityUpdate(teamID uint, entityType string, entityID uint) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if h.Clients[teamID] == nil {
		return
	}

	event := WSEvent{
		Type: EventEntityUpdated,
		Payload: map[string]interface{}{
			"entity_type": entityType,
			"entity_id":   entityID,
		},
	}
	msg, _ := json.Marshal(event)

	for c := range h.Clients[teamID] {
		c.WriteMessage(websocket.TextMessage, msg)
	}
}

// LogActivity is a helper to record activity logs
func LogActivity(db *gorm.DB, teamID uint, userID uint, action string, entityType string, entityID uint, details map[string]interface{}) {
	// Simple implementation
	var detailsJSON repository.JSONB
	if details != nil {
		b, _ := json.Marshal(details)
		json.Unmarshal(b, &detailsJSON)
	} else {
		detailsJSON = repository.JSONB{}
	}
	
	log := repository.ActivityLog{
		TeamID:     teamID,
		UserID:     userID,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		Details:    detailsJSON,
	}
	db.Create(&log)
}

// BroadcastDonationPrompt sends a donation prompt to all connected users or a specific user
func (h *Hub) BroadcastDonationPrompt(userID uint, message string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	event := WSEvent{
		Type: EventDonationPrompt,
		Payload: map[string]interface{}{
			"message": message,
		},
	}
	msg, _ := json.Marshal(event)

	for _, teamClients := range h.Clients {
		for c := range teamClients {
			if userID == 0 || c.UserID == userID {
				c.WriteMessage(websocket.TextMessage, msg)
			}
		}
	}
}

// BroadcastNotification sends a new notification to a specific user
func (h *Hub) BroadcastNotification(userID uint, notification repository.Notification) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	event := WSEvent{
		Type: EventNotificationNew,
		Payload: notification,
	}
	msg, _ := json.Marshal(event)

	// Search for the user in all teams
	found := false
	for teamID, teamClients := range h.Clients {
		for c := range teamClients {
			if c.UserID == userID {
				c.WriteMessage(websocket.TextMessage, msg)
				found = true
				log.Printf("WS: Notification sent to UserID %d in TeamID %d", userID, teamID)
			}
		}
	}
	if !found {
		log.Printf("WS: Could not find active connection for UserID %d to send notification", userID)
	}
}
