<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class QueuedSavMailNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly SavNotificationData $data)
    {
        $this->onQueue((string) config('notifications.mail_queue'));
        $this->afterCommit();
    }

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim((string) config('frontend.url'), '/').$this->data->actionUrl;

        return (new MailMessage)
            ->subject($this->data->title)
            ->greeting('ServiceDesk update')
            ->line($this->data->message)
            ->action('View details', $url)
            ->line('You are receiving this message because of your ServiceDesk activity.');
    }
}
