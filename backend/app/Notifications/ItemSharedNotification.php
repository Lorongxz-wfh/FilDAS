<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ItemSharedNotification extends Notification
{
    use Queueable;

    protected string $itemType;      // "document" | "folder"
    protected string $itemName;
    protected string $permission;    // viewer | contributor | editor
    protected string $sharedByName;
    protected ?int $itemId;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        string $itemType,
        string $itemName,
        string $permission,
        string $sharedByName,
        ?int $itemId = null
    ) {
        $this->itemType = $itemType;
        $this->itemName = $itemName;
        $this->permission = $permission;
        $this->sharedByName = $sharedByName;
        $this->itemId = $itemId;
    }


    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        // Email + in-app (database) notifications
        return ['mail', 'database'];
    }


    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $typeLabel = $this->itemType === 'folder' ? 'folder' : 'document';
        $permLabel = ucfirst($this->permission); // Viewer / Contributor / Editor

        $url = url('/'); // TODO: replace with deep link to the item in FilDAS if you have one

        return (new MailMessage)
            ->subject("{$typeLabel} shared with you in FilDAS")
            ->greeting("Hello {$notifiable->name},")
            ->line("{$this->sharedByName} shared the {$typeLabel} \"{$this->itemName}\" with you as {$permLabel}.")
            ->action('Open FilDAS', $url)
            ->line('You can manage your shared files and folders inside FilDAS.');
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
            'permission'  => $this->permission,
            'shared_by'   => $this->sharedByName,
        ];
    }
}
