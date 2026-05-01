---
description: Panduan langkah-demi-langkah untuk memperbarui atau menambahkan Unit Test di backend Go.
---

# Update Unit Test Workflow — Wapbolt

Workflow ini HARUS digunakan setiap kali ada penambahan fitur baru, perbaikan bug, atau refactoring kode di backend Go, untuk memastikan cakupan pengujian (test coverage) tetap tinggi dan kode terverifikasi.

## 1. Identifikasi Target Pengujian
- Temukan file Go yang berisi logika bisnis, utilitas, atau handler API yang diubah/ditambahkan (misalnya `internal/api/util.go`).
- Jika file pengujian belum ada, buat file baru di direktori yang sama dengan akhiran `_test.go` (misalnya `internal/api/util_test.go`).

## 2. Struktur Pengujian (Go Testing)
Gunakan standar `testing` dari Go. Untuk pengujian endpoint API, gunakan fasilitas testing dari Fiber.

### Format Dasar:
```go
package api // Gunakan package yang sama dengan file sumber

import (
	"testing"
	// import lain
)

func TestNamaFungsi(t *testing.T) {
	// Setup (Given)
	input := "123"
	expected := uint(123)

	// Action (When)
	result := parseUint(input) // Panggil fungsi target

	// Assert (Then)
	if result != expected {
		t.Errorf("Expected %d, got %d", expected, result)
	}
}
```

### Tabel Pengujian (Table-Driven Tests)
Sangat disarankan menggunakan pendekatan tabel untuk menguji berbagai skenario (edge cases) dalam satu fungsi:
```go
func TestParseUint(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected uint
	}{
		{"Valid number", "42", 42},
		{"Empty string", "", 0},
		{"With characters", "42abc", 42},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := parseUint(tt.input); got != tt.expected {
				t.Errorf("parseUint() = %v, want %v", got, tt.expected)
			}
		})
	}
}
```

## 3. Eksekusi dan Verifikasi
Setelah menambahkan pengujian, JANGAN LANGSUNG COMMIT.
Jalankan workflow `check-unit-test.md` untuk memverifikasi bahwa pengujian Anda lolos dan tidak merusak fitur lain.

## 4. Update Dokumentasi
Jika Anda menambahkan pengujian untuk fitur besar yang baru, pastikan untuk mencatatnya di `docs/devlog.md` sebagai bagian dari penyelesaian task.
