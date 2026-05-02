package main

import (
	"bytes"
	"errors"
	"os"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

func TestRun(t *testing.T) {
	os.Setenv("GO_ENV", "test")
	defer os.Unsetenv("GO_ENV")

	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	t.Run("No args", func(t *testing.T) {
		out := &bytes.Buffer{}
		err := Run([]string{"cmd"}, out)
		assert.Error(t, err)
		assert.Contains(t, out.String(), "Expected 'create-user' or 'list-users' subcommands")
	})

	t.Run("Unknown command", func(t *testing.T) {
		out := &bytes.Buffer{}
		err := Run([]string{"cmd", "unknown"}, out)
		assert.Error(t, err)
		assert.Contains(t, out.String(), "Expected 'create-user' or 'list-users' subcommands")
	})

	t.Run("create-user missing flags", func(t *testing.T) {
		out := &bytes.Buffer{}
		err := Run([]string{"cmd", "create-user"}, out)
		assert.Error(t, err)
		assert.Contains(t, out.String(), "Please provide --email, --name, and --password")
	})

	t.Run("create-user success", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		out := &bytes.Buffer{}
		err := Run([]string{"cmd", "create-user", "--email", "a@b.com", "--name", "N", "--password", "p"}, out)
		assert.NoError(t, err)
		assert.Contains(t, out.String(), "Successfully created user")
	})

	t.Run("create-user db error", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"users\"").WillReturnError(errors.New("db error"))
		mock.ExpectRollback()

		out := &bytes.Buffer{}
		err := Run([]string{"cmd", "create-user", "--email", "a@b.com", "--name", "N", "--password", "p"}, out)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to create user")
	})

	t.Run("list-users success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "email", "name", "is_super_admin"}).
				AddRow(1, "a@b.com", "Name", true))

		out := &bytes.Buffer{}
		err := Run([]string{"cmd", "list-users"}, out)
		assert.NoError(t, err)
		assert.Contains(t, out.String(), "ID\tEmail")
		assert.Contains(t, out.String(), "a@b.com")
	})

	t.Run("list-users db error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").WillReturnError(errors.New("db error"))

		out := &bytes.Buffer{}
		err := Run([]string{"cmd", "list-users"}, out)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to list users")
	})
}
