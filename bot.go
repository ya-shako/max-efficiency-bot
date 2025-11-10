package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	maxbot "github.com/max-messenger/max-bot-api-client-go"
	"github.com/max-messenger/max-bot-api-client-go/schemes"
)

func main() {
	ctx := context.Background()

	api, err := maxbot.New(os.Getenv("TOKEN"))
	if err != nil {
		fmt.Printf("Ошибка создания API клиента: %v\n", err)
		os.Exit(1)
	}

	// Тестируем соединение
	info, err := api.Bots.GetBot(ctx)
	if err != nil {
		fmt.Printf("Ошибка получения информации о боте: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Бот: %s\n", info.Name)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		exit := make(chan os.Signal, 1)
		signal.Notify(exit, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
		<-exit
		fmt.Println("\nЗавершение работы...")
		cancel()
	}()

	fmt.Println("Бот запущен и слушает обновления...")

	for upd := range api.GetUpdates(ctx) {
		switch upd := upd.(type) {
		case *schemes.MessageCreatedUpdate:
			fmt.Printf("Новое сообщение! Чат: %s\n", upd.Message.Recipient.ChatId)
			
			// Просто отвечаем без анализа содержимого
			message := maxbot.NewMessage().
				SetChat(upd.Message.Recipient.ChatId).
				SetText("Привет! Я получил ваше сообщение! 🎉")
			
			_, err := api.Messages.Send(ctx, message)
			if err != nil {
				fmt.Printf("Ошибка отправки: %v\n", err)
			}
			
		default:
			fmt.Printf("Другое обновление: %T\n", upd)
		}
	}

	fmt.Println("Бот завершил работу")
}