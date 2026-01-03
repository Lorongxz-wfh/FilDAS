<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ItemUpdatedNotification extends Notification
{
    use Queueable;

    protected string $itemType;      // "document" | "folder"
    protected string $itemName;
    protected string $changeType;    // "renamed" | "updated" | "moved" | etc.
    protected string $updatedByName;
    protected ?int $itemId;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        string $itemType,
        string $itemName,
        string $changeType,
        string $updatedByName,
        ?int $itemId = null
    ) {
        $this->itemType      = $itemType;
        $this->itemName      = $itemName;
        $this->changeType    = $changeType;
        $this->updatedByName = $updatedByName;
        $this->itemId        = $itemId;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }


    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $typeLabel   = $this->itemType === 'folder' ? 'folder' : 'document';
        $changeLabel = ucfirst($this->changeType);

        $url = url('/files'); // For now, edits send owners to Document Manager

        return (new MailMessage)
            ->subject("{$typeLabel} {$changeLabel} in FilDAS")
            ->greeting("Hello {$notifiable->name},")
            ->line("{$this->updatedByName} {$this->changeType} your {$typeLabel} \"{$this->itemName}\".")
            ->action('Open FilDAS', $url)
            ->line('You can review the latest changes to your files and folders in FilDAS.');
    }


    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'item_type'   => $this->itemType,
            'item_id'     => $this->itemId,
            'item_name'   => $this->itemName,
            'change_type' => $this->changeType,
            'updated_by'  => $this->updatedByName,
        ];
    }
}
