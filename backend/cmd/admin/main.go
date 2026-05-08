package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/waluyo/wapbolt-backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if err := Run(os.Args, os.Stdout); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func Run(args []string, out io.Writer) error {
	if os.Getenv("GO_ENV") != "test" {
		if err := godotenv.Load(); err != nil {
			log.Println("No .env file found, relying on environment variables")
		}

		if err := repository.ConnectDB(); err != nil {
			return fmt.Errorf("fatal: %v", err)
		}
	}

	if len(args) < 2 {
		fmt.Fprintln(out, "Expected 'create-user' or 'list-users' subcommands")
		return errors.New("missing subcommand")
	}

	switch args[1] {
	case "create-user":
		return createUser(args[2:], out)
	case "list-users":
		return listUsers(out)
	default:
		fmt.Fprintln(out, "Expected 'create-user' or 'list-users' subcommands")
		return fmt.Errorf("unknown subcommand: %s", args[1])
	}
}

func createUser(args []string, out io.Writer) error {
	createUserCmd := flag.NewFlagSet("create-user", flag.ContinueOnError)
	createUserCmd.SetOutput(out)
	email := createUserCmd.String("email", "", "User email")
	name := createUserCmd.String("name", "", "User name")
	password := createUserCmd.String("password", "", "User password")
	isSuperAdmin := createUserCmd.Bool("super", false, "Is Super Admin")

	if err := createUserCmd.Parse(args); err != nil {
		return err
	}

	if *email == "" || *name == "" || *password == "" {
		fmt.Fprintln(out, "Please provide --email, --name, and --password")
		return errors.New("missing required flags")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %v", err)
	}

	user := repository.User{
		Email:        *email,
		Name:         *name,
		PasswordHash: string(hash),
		IsSuperAdmin: *isSuperAdmin,
	}

	if err := repository.DB.Create(&user).Error; err != nil {
		return fmt.Errorf("failed to create user: %v", err)
	}

	fmt.Fprintf(out, "Successfully created user %s (%s) with ID %d\n", user.Name, user.Email, user.ID)
	return nil
}

func listUsers(out io.Writer) error {
	var users []repository.User
	if err := repository.DB.Find(&users).Error; err != nil {
		return fmt.Errorf("failed to list users: %v", err)
	}
	fmt.Fprintln(out, "ID\tEmail\t\t\tName\t\tSuperAdmin")
	for _, u := range users {
		fmt.Fprintf(out, "%d\t%s\t\t%s\t\t%v\n", u.ID, u.Email, u.Name, u.IsSuperAdmin)
	}
	return nil
}
