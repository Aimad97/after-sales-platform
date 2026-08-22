<?php

namespace Database\Seeders;

use App\Enums\ClientType;
use App\Enums\InvoiceStatus;
use App\Enums\NotificationType;
use App\Enums\RepairResult;
use App\Enums\TechnicianAvailabilityStatus;
use App\Enums\TicketPriority;
use App\Enums\TicketSource;
use App\Enums\TicketStatus;
use App\Enums\UserStatus;
use App\Enums\WarrantyStatus;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Repair;
use App\Models\Technician;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Warranty;
use Carbon\Carbon;
use Database\Factories\DatabaseNotificationFactory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Ramsey\Uuid\Uuid;
use RuntimeException;

class DemoDataSeeder extends Seeder
{
    private const DEMO_EMAIL_DOMAIN = 'servicedesk.test';

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('DemoDataSeeder may only run in local or testing environments.');
        }

        $this->call(RolesAndPermissionsSeeder::class);

        DB::transaction(function (): void {
            $clients = $this->createClients();
            $accounts = $this->createAccounts($clients);
            $catalog = $this->createCatalog();
            $warranties = $this->createSales($clients, $catalog['products']);
            $tickets = $this->createTickets(
                $clients,
                $catalog['products'],
                $warranties,
                $accounts['admins']->merge($accounts['agents']),
                $accounts['technicians'],
            );

            $this->createNotifications($accounts['users'], $tickets);
        });
    }

    /** @return Collection<int, Client> */
    private function createClients(): Collection
    {
        $people = [
            ['Yasmine', 'El Amrani', 'Casablanca'],
            ['Omar', 'Bennani', 'Rabat'],
            ['Salma', 'Alaoui', 'Marrakech'],
            ['Mehdi', 'Idrissi', 'Fes'],
            ['Imane', 'Lahlou', 'Tangier'],
            ['Hamza', 'Tahiri', 'Agadir'],
            ['Nora', 'Chraibi', 'Kenitra'],
            ['Anas', 'Berrada', 'Meknes'],
            ['Sara', 'Benjelloun', 'Oujda'],
            ['Ayoub', 'Fassi', 'Tetouan'],
            ['Lina', 'Amrani', 'El Jadida'],
            ['Zakaria', 'Mernissi', 'Safi'],
            ['Meryem', 'Naciri', 'Mohammedia'],
            ['Rayan', 'Kabbaj', 'Casablanca'],
            ['Hajar', 'Skalli', 'Rabat'],
            ['Ilyas', 'Ouazzani', 'Marrakech'],
            ['Ghita', 'Tazi', 'Tangier'],
            ['Adam', 'Lamrani', 'Agadir'],
        ];

        return collect($people)->map(function (array $person, int $index): Client {
            $number = $index + 1;
            $email = $index === 0
                ? 'client@'.self::DEMO_EMAIL_DOMAIN
                : sprintf('client%02d@example.test', $number);
            $isCompany = $number % 5 === 0;
            $client = Client::query()->firstOrNew(['email' => $email]);

            if (! $client->exists) {
                $client->uuid = (string) Str::uuid();
            }

            $client->forceFill([
                'type' => $isCompany ? ClientType::Company : ClientType::Individual,
                'company_name' => $isCompany ? "Atlas Solutions {$number}" : null,
                'first_name' => $person[0],
                'last_name' => $person[1],
                'phone' => sprintf('+2126%08d', 10000000 + $number),
                'address' => sprintf('%d Avenue Hassan II', 10 + $number),
                'city' => $person[2],
                'tax_identifier' => $isCompany ? sprintf('ICE-DEMO-%06d', $number) : null,
                'notes' => $number % 4 === 0 ? 'Prefers contact by email during business hours.' : null,
            ])->save();

            return $client;
        })->values();
    }

    /**
     * @param  Collection<int, Client>  $clients
     * @return array{admins: Collection<int, User>, agents: Collection<int, User>, technicians: Collection<int, Technician>, users: Collection<int, User>}
     */
    private function createAccounts(Collection $clients): array
    {
        $admins = collect([
            $this->account('superadmin@'.self::DEMO_EMAIL_DOMAIN, 'Sofia', 'Admin', 'super_admin', 1),
            $this->account('admin@'.self::DEMO_EMAIL_DOMAIN, 'Amine', 'Manager', 'admin', 2),
            $this->account('admin.operations@'.self::DEMO_EMAIL_DOMAIN, 'Leila', 'Operations', 'admin', 3),
        ]);

        $agents = collect([
            $this->account('agent@'.self::DEMO_EMAIL_DOMAIN, 'Nadia', 'Support', 'sav_agent', 10),
            $this->account('agent.youssef@'.self::DEMO_EMAIL_DOMAIN, 'Youssef', 'Support', 'sav_agent', 11),
            $this->account('agent.kenza@'.self::DEMO_EMAIL_DOMAIN, 'Kenza', 'Support', 'sav_agent', 12),
            $this->account('agent.rania@'.self::DEMO_EMAIL_DOMAIN, 'Rania', 'Support', 'sav_agent', 13),
        ]);

        $technicianProfiles = [
            ['technician@'.self::DEMO_EMAIL_DOMAIN, 'Karim', 'Mansouri', 'Computer hardware', 5, TechnicianAvailabilityStatus::Busy],
            ['technician.samir@'.self::DEMO_EMAIL_DOMAIN, 'Samir', 'Haddad', 'Mobile devices', 4, TechnicianAvailabilityStatus::Available],
            ['technician.aya@'.self::DEMO_EMAIL_DOMAIN, 'Aya', 'Farah', 'Printers and imaging', 4, TechnicianAvailabilityStatus::Busy],
            ['technician.adil@'.self::DEMO_EMAIL_DOMAIN, 'Adil', 'Rami', 'Networking equipment', 3, TechnicianAvailabilityStatus::Available],
            ['technician.ines@'.self::DEMO_EMAIL_DOMAIN, 'Ines', 'Saidi', 'Displays and peripherals', 4, TechnicianAvailabilityStatus::Available],
            ['technician.bilal@'.self::DEMO_EMAIL_DOMAIN, 'Bilal', 'Najjar', 'Consumer electronics', 3, TechnicianAvailabilityStatus::Leave],
        ];

        $technicians = collect($technicianProfiles)->map(function (array $profile, int $index): Technician {
            $user = $this->account($profile[0], $profile[1], $profile[2], 'technician', 20 + $index);
            $technician = Technician::query()->firstOrNew(['employee_code' => sprintf('TECH-%03d', $index + 1)]);
            $technician->forceFill([
                'user_id' => $user->id,
                'specialization' => $profile[3],
                'skill_level' => $profile[4],
                'availability_status' => $profile[5],
                'notes' => $profile[5] === TechnicianAvailabilityStatus::Leave ? 'Scheduled leave for the current demo period.' : null,
            ])->save();

            return $technician;
        });

        $clientUsers = $clients->take(6)->values()->map(function (Client $client, int $index): User {
            $email = $index === 0 ? 'client@'.self::DEMO_EMAIL_DOMAIN : sprintf('portal.client%02d@%s', $index + 1, self::DEMO_EMAIL_DOMAIN);

            return $this->account(
                $email,
                $client->first_name,
                $client->last_name,
                'client',
                40 + $index,
                $client,
            );
        });

        return [
            'admins' => $admins,
            'agents' => $agents,
            'technicians' => $technicians,
            'users' => $admins
                ->merge($agents)
                ->merge($technicians->map->user)
                ->merge($clientUsers)
                ->values(),
        ];
    }

    private function account(
        string $email,
        string $firstName,
        string $lastName,
        string $role,
        int $phoneSuffix,
        ?Client $client = null,
    ): User {
        $user = User::query()->firstOrNew(['email' => $email]);

        if (! $user->exists) {
            $user->uuid = (string) Str::uuid();
        }

        $user->forceFill([
            'client_id' => $client?->id,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email_verified_at' => now(),
            'phone' => sprintf('+2126%08d', 20000000 + $phoneSuffix),
            'password' => Hash::make((string) config('demo.password')),
            'locale' => 'fr',
            'timezone' => 'Africa/Casablanca',
            'status' => UserStatus::Active,
        ])->save();
        $user->syncRoles($role);

        return $user;
    }

    /** @return array{brands: Collection<int, Brand>, categories: Collection<int, Category>, products: Collection<int, Product>} */
    private function createCatalog(): array
    {
        $brandNames = ['Lenovo', 'Dell', 'HP', 'Asus', 'Acer', 'Samsung', 'Canon', 'TP-Link'];
        $brands = collect($brandNames)->map(function (string $name): Brand {
            return Brand::query()->updateOrCreate(
                ['name' => $name],
                ['slug' => Str::slug($name), 'logo_path' => null, 'active' => true],
            );
        })->keyBy('name');

        $categoryDefinitions = [
            'Laptops' => 'Portable computers for professional and personal use.',
            'Desktop computers' => 'Workstations and compact desktop computers.',
            'Monitors' => 'Desktop displays and professional monitors.',
            'Printers' => 'Laser, inkjet, and multifunction printers.',
            'Networking' => 'Routers, access points, and network switches.',
            'Accessories' => 'Keyboards, mice, docks, and related peripherals.',
        ];
        $categories = collect($categoryDefinitions)->mapWithKeys(function (string $description, string $name): array {
            $category = Category::query()->updateOrCreate(
                ['name' => $name],
                ['slug' => Str::slug($name), 'description' => $description, 'active' => true],
            );

            return [$name => $category];
        });

        $definitions = [
            ['PC-THINK-E14', 'Lenovo ThinkPad E14', '20RA', 'Lenovo', 'Laptops', 24, true],
            ['PC-LATI-5440', 'Dell Latitude 5440', 'LAT5440', 'Dell', 'Laptops', 36, true],
            ['PC-ELIT-840', 'HP EliteBook 840', 'G10', 'HP', 'Laptops', 24, true],
            ['PC-VIVO-15', 'Asus VivoBook 15', 'X1504', 'Asus', 'Laptops', 12, true],
            ['PC-VERI-N4', 'Acer Veriton N4', 'N4690GT', 'Acer', 'Desktop computers', 24, true],
            ['PC-OPTI-7010', 'Dell OptiPlex 7010', 'OPT7010', 'Dell', 'Desktop computers', 36, true],
            ['PC-PROD-400', 'HP ProDesk 400', 'G9', 'HP', 'Desktop computers', 24, true],
            ['MON-S24A400', 'Samsung S24A400 Monitor', 'S24A400', 'Samsung', 'Monitors', 24, true],
            ['MON-P2422H', 'Dell P2422H Monitor', 'P2422H', 'Dell', 'Monitors', 36, true],
            ['MON-VZ249', 'Asus Eye Care Monitor', 'VZ249HE', 'Asus', 'Monitors', 24, true],
            ['PRN-LBP223', 'Canon i-SENSYS LBP223dw', 'LBP223DW', 'Canon', 'Printers', 12, true],
            ['PRN-M404DN', 'HP LaserJet Pro M404dn', 'M404DN', 'HP', 'Printers', 24, true],
            ['PRN-G3470', 'Canon PIXMA G3470', 'G3470', 'Canon', 'Printers', 12, true],
            ['NET-AX55', 'TP-Link Archer AX55', 'AX55', 'TP-Link', 'Networking', 24, true],
            ['NET-SG108', 'TP-Link TL-SG108 Switch', 'TL-SG108', 'TP-Link', 'Networking', 36, true],
            ['ACC-DOCK40', 'Lenovo USB-C Dock', '40AY', 'Lenovo', 'Accessories', 12, true],
            ['ACC-KM7321', 'Dell Premier Keyboard and Mouse', 'KM7321W', 'Dell', 'Accessories', 12, false],
            ['ACC-TUF-M4', 'Asus TUF Gaming Mouse', 'M4-AIR', 'Asus', 'Accessories', 12, false],
        ];

        $products = collect($definitions)->map(function (array $definition) use ($brands, $categories): Product {
            $product = Product::query()->firstOrNew(['sku' => $definition[0]]);

            if (! $product->exists) {
                $product->uuid = (string) Str::uuid();
            }

            $product->forceFill([
                'name' => $definition[1],
                'slug' => Str::slug($definition[1]),
                'description' => "Demo catalog item: {$definition[1]}.",
                'category_id' => $categories[$definition[4]]->id,
                'brand_id' => $brands[$definition[3]]->id,
                'model' => $definition[2],
                'default_warranty_months' => $definition[5],
                'serial_number_required' => $definition[6],
                'active' => true,
            ])->save();

            return $product;
        })->values();

        return ['brands' => $brands->values(), 'categories' => $categories->values(), 'products' => $products];
    }

    /**
     * @param  Collection<int, Client>  $clients
     * @param  Collection<int, Product>  $products
     * @return Collection<int, Warranty>
     */
    private function createSales(Collection $clients, Collection $products): Collection
    {
        $warranties = collect();
        $serialCounter = 1;

        for ($invoiceIndex = 0; $invoiceIndex < 36; $invoiceIndex++) {
            $client = $clients[$invoiceIndex % $clients->count()];
            $invoiceDate = today()->subMonths(($invoiceIndex * 5) % 30)->subDays($invoiceIndex % 17);
            $status = match (true) {
                $invoiceIndex % 10 === 0 => InvoiceStatus::Draft,
                $invoiceIndex % 10 === 1 => InvoiceStatus::Void,
                default => InvoiceStatus::Issued,
            };
            $invoice = Invoice::query()->updateOrCreate(
                ['invoice_number' => sprintf('INV-DEMO-%04d', $invoiceIndex + 1)],
                [
                    'client_id' => $client->id,
                    'invoice_date' => $invoiceDate,
                    'subtotal_amount' => '0.00',
                    'tax_rate' => '20.00',
                    'tax_amount' => '0.00',
                    'total_amount' => '0.00',
                    'status' => $status,
                    'notes' => $status === InvoiceStatus::Void ? 'Voided demo invoice retained for reporting.' : null,
                ],
            );
            $subtotal = 0.0;

            for ($line = 0; $line < 2; $line++) {
                $product = $products[($invoiceIndex * 2 + $line) % $products->count()];
                $unitPrice = 650.0 + (($product->id * 337 + $line * 125) % 14200);
                $lineTax = round($unitPrice * 0.20, 2);
                $serial = sprintf('DEMO-SN-%05d', $serialCounter);
                $warrantyMonths = $product->default_warranty_months;
                $warrantyEnd = $invoiceDate->copy()->addMonthsNoOverflow($warrantyMonths);
                $item = $invoice->items()->updateOrCreate(
                    ['serial_number' => $serial],
                    [
                        'product_id' => $product->id,
                        'quantity' => 1,
                        'unit_price' => number_format($unitPrice, 2, '.', ''),
                        'warranty_months' => $warrantyMonths,
                        'warranty_start_date' => $invoiceDate,
                        'warranty_end_date' => $warrantyEnd,
                        'line_subtotal' => number_format($unitPrice, 2, '.', ''),
                        'line_tax' => number_format($lineTax, 2, '.', ''),
                        'line_total' => number_format($unitPrice + $lineTax, 2, '.', ''),
                    ],
                );
                $subtotal += $unitPrice;

                if ($status === InvoiceStatus::Issued) {
                    $warrantyStatus = match (true) {
                        $serialCounter % 17 === 0 => WarrantyStatus::Replaced,
                        $serialCounter % 13 === 0 => WarrantyStatus::Void,
                        $warrantyEnd->isBefore(today()) => WarrantyStatus::Expired,
                        default => WarrantyStatus::Active,
                    };
                    $warranty = Warranty::query()->firstOrNew(['serial_number' => $serial]);

                    if (! $warranty->exists) {
                        $warranty->uuid = (string) Str::uuid();
                    }

                    $warranty->forceFill([
                        'customer_id' => $client->id,
                        'product_id' => $product->id,
                        'invoice_item_id' => $item->id,
                        'quantity' => 1,
                        'purchase_date' => $invoiceDate,
                        'warranty_end' => $warrantyEnd,
                        'starts_at' => $invoiceDate,
                        'expires_at' => $warrantyEnd,
                        'status' => $warrantyStatus,
                        'void_reason' => $warrantyStatus === WarrantyStatus::Void ? 'Physical damage is outside standard coverage.' : null,
                        'notes' => $warrantyStatus === WarrantyStatus::Replaced ? 'Original unit replaced under warranty.' : null,
                    ])->save();
                    $warranties->push($warranty);
                }

                $serialCounter++;
            }

            $tax = round($subtotal * 0.20, 2);
            $invoice->forceFill([
                'subtotal_amount' => number_format($subtotal, 2, '.', ''),
                'tax_amount' => number_format($tax, 2, '.', ''),
                'total_amount' => number_format($subtotal + $tax, 2, '.', ''),
            ])->save();
        }

        return $warranties->values();
    }

    /**
     * @param  Collection<int, Client>  $clients
     * @param  Collection<int, Product>  $products
     * @param  Collection<int, Warranty>  $warranties
     * @param  Collection<int, User>  $creators
     * @param  Collection<int, Technician>  $technicians
     * @return Collection<int, Ticket>
     */
    private function createTickets(
        Collection $clients,
        Collection $products,
        Collection $warranties,
        Collection $creators,
        Collection $technicians,
    ): Collection {
        $activeWarranties = $warranties->filter(fn (Warranty $warranty): bool => $warranty->isUnderWarranty())->values();
        $ineligibleWarranties = $warranties->reject(fn (Warranty $warranty): bool => $warranty->isUnderWarranty())->values();
        $statuses = TicketStatus::cases();
        $priorities = [
            TicketPriority::Normal,
            TicketPriority::Normal,
            TicketPriority::High,
            TicketPriority::Low,
            TicketPriority::Urgent,
            TicketPriority::Normal,
            TicketPriority::High,
        ];
        $problems = [
            ['Laptop does not power on', 'The device stopped powering on after normal use; no charging indicator is visible.'],
            ['Intermittent blue screen', 'The computer restarts with a blue screen during normal office workloads.'],
            ['Printer leaves vertical streaks', 'Every printed page contains dark vertical lines along the right edge.'],
            ['Wi-Fi connection drops', 'Wireless connectivity disconnects several times per hour on multiple networks.'],
            ['Monitor flickers after warm-up', 'The display starts flickering after approximately twenty minutes of use.'],
            ['Battery drains unusually fast', 'A full charge lasts less than one hour with light productivity use.'],
            ['Keyboard keys are unresponsive', 'Several keys intermittently fail even after the keyboard is cleaned.'],
            ['Device overheats under load', 'Fans run at maximum speed and the system shuts down during demanding work.'],
            ['Paper feed mechanism jams', 'Paper consistently jams near the input tray regardless of paper type.'],
            ['USB-C dock not detected', 'Connected monitors and USB peripherals are no longer detected through the dock.'],
            ['Ethernet ports lose connectivity', 'Wired connections drop until the network switch is restarted.'],
            ['Unexpected display artifacts', 'Colored blocks and lines appear on screen after resuming from sleep.'],
        ];
        $repairStatuses = [
            TicketStatus::Diagnosing,
            TicketStatus::AwaitingCustomerApproval,
            TicketStatus::AwaitingPart,
            TicketStatus::Repairing,
            TicketStatus::Testing,
            TicketStatus::Repaired,
            TicketStatus::ReadyForPickup,
            TicketStatus::Delivered,
            TicketStatus::Closed,
        ];
        $completedRepairStatuses = [
            TicketStatus::Repaired,
            TicketStatus::ReadyForPickup,
            TicketStatus::Delivered,
            TicketStatus::Closed,
        ];
        $tickets = collect();

        for ($index = 0; $index < 72; $index++) {
            $status = $statuses[$index % count($statuses)];
            $createdAt = $this->ticketDate($index);

            if ($index === 0) {
                $status = TicketStatus::Closed;
                $createdAt = now()->subHours(9);
            } elseif ($index === 1) {
                $status = TicketStatus::Opened;
                $createdAt = now()->subHours(2);
            }

            $warranty = match ($index % 3) {
                0 => $activeWarranties[$index % $activeWarranties->count()],
                1 => $ineligibleWarranties[$index % $ineligibleWarranties->count()],
                default => null,
            };
            $client = $warranty?->client ?? $clients[$index % $clients->count()];
            $product = $warranty?->product ?? $products[($index * 5) % $products->count()];
            $requiresRepair = in_array($status, $repairStatuses, true);
            $technician = ($index % 6 !== 0 || $requiresRepair)
                ? $technicians[($index * 7) % $technicians->count()]
                : null;
            $closedAt = $status->isTerminal()
                ? $this->notAfterNow($createdAt->copy()->addHours(8 + (($index * 13) % 144)))
                : null;
            $problem = $problems[$index % count($problems)];
            $ticket = Ticket::query()->firstOrNew(['ticket_number' => sprintf('TKT-DEMO-%04d', $index + 1)]);

            if (! $ticket->exists) {
                $ticket->uuid = (string) Str::uuid();
            }

            $ticket->forceFill([
                'client_id' => $client->id,
                'customer_id' => $client->id,
                'product_id' => $product->id,
                'warranty_id' => $warranty?->id,
                'customer_product_id' => $warranty?->id,
                'invoice_item_id' => $warranty?->invoice_item_id,
                'title' => $problem[0],
                'subject' => $problem[0],
                'problem_description' => $problem[1],
                'description' => $problem[1],
                'priority' => $index === 1 ? TicketPriority::Urgent : $priorities[$index % count($priorities)],
                'status' => $status,
                'source' => TicketSource::cases()[$index % count(TicketSource::cases())],
                'warranty_eligible' => $warranty?->isUnderWarranty() ?? false,
                'created_by' => $creators[$index % $creators->count()]->id,
                'assigned_technician_id' => $technician?->id,
                'received_at' => $createdAt,
                'opened_at' => $createdAt,
                'closed_at' => $closedAt,
                'created_at' => $createdAt,
                'updated_at' => $closedAt ?? $createdAt->copy()->addHours(2),
            ])->save();

            if ($requiresRepair && $technician !== null) {
                $this->createRepair($ticket, $technician, $createdAt, in_array($status, $completedRepairStatuses, true), $index);
            }

            $tickets->push($ticket);
        }

        return $tickets->values();
    }

    private function ticketDate(int $index): Carbon
    {
        $month = now()->startOfMonth()->subMonths(5)->addMonths($index % 6);
        $lastPossibleDay = $month->copy()->endOfMonth();

        if ($lastPossibleDay->isAfter(now())) {
            $lastPossibleDay = now();
        }

        $availableDays = max(0, $month->copy()->startOfDay()->diffInDays($lastPossibleDay->copy()->startOfDay()));
        $date = $month->copy()
            ->addDays(($index * 7) % ($availableDays + 1))
            ->setTime(8 + ($index % 9), ($index * 11) % 60);

        return $this->notAfterNow($date);
    }

    private function notAfterNow(Carbon $date): Carbon
    {
        return $date->isAfter(now()) ? now()->subMinutes(5) : $date;
    }

    private function createRepair(Ticket $ticket, Technician $technician, Carbon $receivedAt, bool $completed, int $index): void
    {
        $startedAt = $this->notAfterNow($receivedAt->copy()->addHours(4 + ($index % 20)));
        $completedAt = $completed
            ? $this->notAfterNow($startedAt->copy()->addHours(2 + (($index * 3) % 30)))
            : null;
        $laborCost = 120.0 + (($index * 35) % 650);
        $partsCost = $completed ? (float) (($index * 175) % 2400) : 0.0;
        $results = RepairResult::cases();
        $repair = Repair::query()->firstOrNew(['ticket_id' => $ticket->id]);
        $repair->forceFill([
            'technician_id' => $technician->id,
            'diagnosis' => 'Diagnostic tests reproduced the reported fault and isolated the affected component.',
            'root_cause' => 'Normal component wear combined with repeated thermal cycling.',
            'repair_action' => $completed ? 'The affected component was replaced, firmware was updated, and final tests passed.' : 'Repair work is in progress; required parts and test procedures are prepared.',
            'internal_notes' => 'Demo repair record generated for workload and performance reporting.',
            'customer_notes' => $completed ? 'Your device has completed technical testing.' : 'Your device is currently being serviced.',
            'labor_cost' => number_format($laborCost, 2, '.', ''),
            'parts_cost' => number_format($partsCost, 2, '.', ''),
            'total_cost' => number_format($laborCost + $partsCost, 2, '.', ''),
            'started_at' => $startedAt,
            'completed_at' => $completedAt,
            'result' => $completed ? $results[$index % count($results)] : null,
            'created_at' => $startedAt,
            'updated_at' => $completedAt ?? $startedAt->copy()->addHour(),
        ])->save();
    }

    /**
     * @param  Collection<int, User>  $users
     * @param  Collection<int, Ticket>  $tickets
     */
    private function createNotifications(Collection $users, Collection $tickets): void
    {
        $types = NotificationType::cases();

        $users->each(function (User $user) use ($tickets, $types): void {
            $relevantTickets = (match (true) {
                $user->hasRole('client') => $tickets->where('client_id', $user->client_id),
                $user->hasRole('technician') => $tickets->where('assigned_technician_id', $user->technician?->id),
                default => $tickets,
            })->values();

            if ($relevantTickets->isEmpty()) {
                $relevantTickets = $tickets;
            }

            for ($offset = 0; $offset < 6; $offset++) {
                $ticket = $relevantTickets[($user->id + $offset * 3) % $relevantTickets->count()];
                $notification = DatabaseNotificationFactory::new()
                    ->forUser($user)
                    ->forTicket($ticket, $types[($user->id + $offset) % count($types)])
                    ->make([
                        'id' => Uuid::uuid5(Uuid::NAMESPACE_URL, "servicedesk-demo-notification:{$user->email}:{$offset}")->toString(),
                        'read_at' => $offset < 3 ? now()->subDays($offset)->subHours(2) : null,
                        'created_at' => now()->subDays($offset)->subHours($user->id % 8),
                        'updated_at' => now()->subDays($offset)->subHours($user->id % 8),
                    ]);

                DB::table('notifications')->updateOrInsert(
                    ['id' => $notification->id],
                    $notification->getAttributes(),
                );
            }
        });
    }
}
