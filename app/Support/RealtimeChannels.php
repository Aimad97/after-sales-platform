<?php

namespace App\Support;

use Illuminate\Broadcasting\PrivateChannel;

final class RealtimeChannels
{
    public static function user(int $userId): PrivateChannel
    {
        return new PrivateChannel("user.{$userId}");
    }

    /**
     * @param  list<int>  $userIds
     * @return list<PrivateChannel>
     */
    public static function ticketAndUsers(int $ticketId, array $userIds): array
    {
        $channels = [new PrivateChannel("ticket.{$ticketId}")];

        return [...$channels, ...self::users($userIds)];
    }

    /**
     * @param  list<int>  $userIds
     * @return list<PrivateChannel>
     */
    public static function users(array $userIds): array
    {
        return array_map(
            static fn (int $userId): PrivateChannel => self::user($userId),
            array_values(array_unique($userIds)),
        );
    }
}
