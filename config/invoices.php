<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Default tax rate
    |--------------------------------------------------------------------------
    |
    | Invoice amounts are always calculated on the server. This value is used
    | when a permitted staff user does not supply an invoice-specific rate.
    |
    */
    'default_tax_rate' => (float) env('INVOICE_DEFAULT_TAX_RATE', 20),
];
