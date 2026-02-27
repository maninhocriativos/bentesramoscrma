

## Plan: Optimize Chat Speed to WhatsApp-Level Performance

### Analysis of Current Bottlenecks

1. **File/Image sending is sequential**: upload → sign URL → send Z-API → save DB (each step waits for the previous)
2. **Audio sending**: upload and sign are sequential before Z-API call
3. **loadSubscribers is heavy**: on every mount/focus/poll, it fetches ALL subscribers, then ALL leads for tipo_origem, then 500+ messages for instance detection -- 4 DB round-trips
4. **scrollToBottom uses smooth animation**: delays visual feedback on new messages
5. **Message deduplication runs expensive checks** on every realtime event and every message render
6. **Conversation switching reloads messages** even when cache exists and is fresh
7. **Subscriber list re-renders** on every single realtime message (moves subscriber to top)

### Implementation Steps

#### 1. Parallelize file/media upload pipeline
- In `sendMessage` for media types: upload to storage AND prepare Z-API call metadata in parallel
- Sign URL immediately after upload, then fire Z-API send and DB insert concurrently (don't await DB)
- Same pattern for `uploadAndSendFile` -- currently fully sequential

#### 2. Make `scrollToBottom` instant for new messages
- Change `behavior: 'smooth'` to `behavior: 'instant'` (or no behavior) when appending new messages
- Keep smooth scroll only for user-initiated scroll actions

#### 3. Lighten `loadSubscribers` -- cache instance metadata
- Store instance_name in `manychat_subscribers` table directly (already has the column)
- On loadSubscribers, skip the two extra queries (messages by lead_id and messages by subscriber_id for instance detection) when `instance_name` is already populated
- Only query messages for subscribers missing `instance_name`
- This eliminates ~1000 row fetches on every focus/poll

#### 4. Optimize conversation switching with cache-first approach
- When cache exists AND is less than 30 seconds old, show cache immediately and skip DB fetch
- Track cache freshness with a timestamp map alongside `messagesCacheRef`
- Still refresh in background silently (no loading spinner)

#### 5. Debounce subscriber list reordering from realtime
- Currently every realtime message triggers `setSubscribers` to move a contact to top
- Batch these updates with a 500ms debounce to avoid rapid re-renders when multiple messages arrive

#### 6. Non-blocking DB persistence for ALL message types
- Text messages: already fire-and-forget the interacao insert, but still `await` the main message insert. Make it non-blocking like audio
- Apply the same `.then()` pattern used in `sendAudioFromPreview` to the main `sendMessage` function

#### 7. Optimize deduplication with Set instead of Array.some()
- Replace `prev.some(m => m.id === newMsg.id || getMessageDedupeKey(m) === key)` with a `Set<string>` of dedup keys maintained alongside messages
- Reduces O(n) scan on every new message to O(1) lookup

### Files to Modify
- `src/components/manychat/ChatInbox.tsx` -- all 7 optimizations above
- No database migrations needed
- No edge function changes needed

