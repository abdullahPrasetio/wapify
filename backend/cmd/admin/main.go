package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/waluyo/wapbolt-backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	repository.ConnectDB()

	if len(os.Args) < 2 {
		fmt.Println("Expected 'create-user' or 'list-users' subcommands")
		os.Exit(1)
	}

	switch os.Args[1] {
	case "create-user":
		createUserCmd := flag.NewFlagSet("create-user", flag.ExitOnError)
		email := createUserCmd.String("email", "", "User email")
		name := createUserCmd.String("name", "", "User name")
		password := createUserCmd.String("password", "", "User password")
		isSuperAdmin := createUserCmd.Bool("super", false, "Is Super Admin")

		createUserCmd.Parse(os.Args[2:])

		if *email == "" || *name == "" || *password == "" {
			fmt.Println("Please provide --email, --name, and --password")
			os.Exit(1)
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Failed to hash password: %v", err)
		}

		user := repository.User{
			Email:        *email,
			Name:         *name,
			PasswordHash: string(hash),
			IsSuperAdmin: *isSuperAdmin,
		}

		if err := repository.DB.Create(&user).Error; err != nil {
			log.Fatalf("Failed to create user: %v", err)
		}

		fmt.Printf("Successfully created user %s (%s) with ID %d\n", user.Name, user.Email, user.ID)

	case "list-users":
		var users []repository.User
		if err := repository.DB.Find(&users).Error; err != nil {
			log.Fatalf("Failed to list users: %v", err)
		}
		fmt.Println("ID\tEmail\t\t\tName\t\tSuperAdmin")
		for _, u := range users {
			fmt.Printf("%d\t%s\t\t%s\t\t%v\n", u.ID, u.Email, u.Name, u.IsSuperAdmin)
		}

	default:
		fmt.Println("Expected 'create-user' or 'list-users' subcommands")
		os.Exit(1)
	}
}
