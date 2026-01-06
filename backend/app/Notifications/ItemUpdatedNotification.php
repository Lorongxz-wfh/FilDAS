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
        $typeLabel = $this->itemType === 'folder' ? 'folder' : 'document';

        // Human‑friendly labels for common change types
        $reasonText = null;
        $normalizedChange = $this->changeType;

        if (str_starts_with($this->changeType, 'rejected_with_reason:')) {
            $normalizedChange = 'rejected';
            $reasonText = trim(substr($this->changeType, strlen('rejected_with_reason:')));
        }

        $subjectLabel = match ($normalizedChange) {
            'submitted for QA review' => 'submitted for QA review',
            'approved'                => 'approved',
            'rejected'                => 'rejected',
            default                   => $normalizedChange,
        };

        $url = url('/files'); // For now, edits send owners to Document Manager

        // Different sentences depending on change type
        if ($normalizedChange === 'submitted for QA review') {
            $line = "{$this->updatedByName} submitted the {$typeLabel} \"{$this->itemName}\" for QA review.";
        } else {
            $line = "{$this->updatedByName} {$subjectLabel} your {$typeLabel} \"{$this->itemName}\".";
        }

        if ($normalizedChange === 'rejected' && $reasonText) {
            $line .= ' Reason: ' . $reasonText;
        }

        return (new MailMessage)
            ->subject(ucfirst($typeLabel) . ' ' . $subjectLabel . ' in FilDAS')
            ->greeting("Hello {$notifiable->name},")
            ->line($line)
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
