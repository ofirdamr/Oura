#!/usr/bin/env node

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function fetchSupabase(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${url}${endpoint}`, options);
  const text = await response.text();

  if (!response.ok) {
    console.error(`HTTP ${response.status}:`, text);
    throw new Error(`Request failed: ${response.statusText}`);
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

async function main() {
  try {
    console.log('Fetching WED-2024 event...');
    const events = await fetchSupabase('events?code=eq.WED-2024&select=id,code');

    if (!events || events.length === 0) {
      console.error('WED-2024 event not found');
      process.exit(1);
    }

    const eventId = events[0].id;
    console.log(`✓ Found event: ${events[0].code} (${eventId})`);

    console.log('Fetching test photo...');
    const photos = await fetchSupabase(`photos?event_id=eq.${eventId}&select=id,storage_key,is_original_uploaded&limit=1`);

    if (!photos || photos.length === 0) {
      console.error('No photos found in event');
      process.exit(1);
    }

    const photoId = photos[0].id;
    console.log(`✓ Found photo: ${photoId} (is_original_uploaded=${photos[0].is_original_uploaded})`);

    console.log('Creating test orders...');
    const testOrders = [
      {
        event_id: eventId,
        photo_id: photoId,
        guest_token: 'test-token-1',
        format: 'print_10x15',
        fulfillment_type: 'SELF_FULFILLMENT',
        order_status: 'Ready_For_Photographer_Print',
        quantity: 1,
        guest_name: 'Test Guest 1',
        price_agorot: 4900,
      },
      {
        event_id: eventId,
        photo_id: photoId,
        guest_token: 'test-token-2',
        format: 'magnet',
        fulfillment_type: 'SELF_FULFILLMENT',
        order_status: 'Ready_For_Photographer_Print',
        quantity: 2,
        guest_name: 'Test Guest 2',
        price_agorot: 2400,
      },
      {
        event_id: eventId,
        photo_id: photoId,
        guest_token: 'test-token-3',
        format: 'photo_book',
        fulfillment_type: 'SELF_FULFILLMENT',
        order_status: 'Ready_For_Photographer_Print',
        quantity: 1,
        guest_name: 'Test Guest 3',
        price_agorot: 9900,
      },
    ];

    const response = await fetchSupabase('orders', 'POST', testOrders);

    if (Array.isArray(response)) {
      console.log(`\n✅ Created ${response.length} test orders:`);
      response.forEach((order, i) => {
        console.log(`  ${i + 1}. ${order.guest_name} - ${order.format} (qty: ${order.quantity}) [${order.order_status}]`);
      });
      console.log(`\nView print queue: https://oura-web.oura-events.workers.dev/admin/print-queue`);
    } else {
      console.log('Response:', response);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
