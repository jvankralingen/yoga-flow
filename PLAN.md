# Plan: Synchronisatie Beeld en Geluid

## Probleem
De AI detecteert pose-namen in de transcript en triggert de volgende pose te vroeg. De voice-over loopt achter op het beeld omdat:
1. De transcript wordt real-time ontvangen (tekst komt eerder dan audio)
2. AI noemt soms poses vooruit ("...en daarna gaan we naar Thread the Needle")
3. AI weet niet wanneer hij "klaar" is - hij heeft geen tijdsbesef

## Gekozen Oplossing: AI in lead + Timer als validatie

AI bepaalt het tempo, maar de timer voorkomt te snelle wissels.

### Werking

1. **Timer start bij elke pose** (bijv. 25 seconden minimum)
2. **AI roept `show_next_pose()` aan** wanneer hij denkt klaar te zijn
3. **Systeem valideert:**
   - Timer nog niet afgelopen → Weiger, stuur "nog X seconden" terug, AI praat door
   - Timer wel afgelopen → Accepteer, wissel beeld, bevestig aan AI
4. **AI gaat door** naar volgende pose na bevestiging

### Voordelen
- Natuurlijke flow (AI bepaalt wanneer hij klaar is)
- Geen te snelle wissels (timer als vangnet)
- AI kan langer bij een pose blijven, maar niet korter dan minimum
- Sync gegarandeerd - beeld wisselt alleen na gevalideerde tool-call

### Sequence diagram

```
AI                          Frontend                    Timer
 |                              |                         |
 |-- start pose 1 ------------->| start timer (25s)       |
 |                              |------------------------>|
 |   ... begeleidt pose ...     |                         |
 |                              |                         |
 |-- show_next_pose() --------->| check: timer done?      |
 |                              |------------------------>|
 |<-- "nog 12 seconden" --------|  (nee)                  |
 |                              |                         |
 |   ... praat door ...         |                         |
 |                              |                    [25s]|
 |-- show_next_pose() --------->| check: timer done?      |
 |                              |------------------------>|
 |<-- "OK, pose 2 gestart" -----|  (ja) → wissel beeld    |
 |                              |  start nieuwe timer     |
 |   ... begeleidt pose 2 ...   |                         |
```

## Implementatie

### 1. Tool definitie (session API)
```typescript
{
  name: 'show_next_pose',
  description: 'Roep dit aan om naar de volgende pose te gaan. Als de minimum tijd nog niet is verstreken, krijg je te horen hoeveel seconden je nog moet wachten.',
  parameters: {}
}
```

### 2. Instructions aanpassen
```
WORKFLOW PER POSE:
1. Begeleid de pose met instructies en ademhalingsoefeningen
2. Wanneer je klaar bent, roep show_next_pose() aan
3. Als je "nog X seconden" krijgt: blijf de student begeleiden tot je het opnieuw mag proberen
4. Als je bevestiging krijgt: kondig de nieuwe pose aan en ga door

BELANGRIJK:
- Roep show_next_pose() ALLEEN aan als je echt klaar bent met de begeleiding
- Als je moet wachten, vul de tijd met ademhalingsinstructies of aanmoediging
```

### 3. Frontend state
```typescript
// In useRealtimeYoga
const poseStartTimeRef = useRef<number>(0);
const MIN_POSE_DURATION = 25000; // 25 seconden minimum

// Bij start pose
poseStartTimeRef.current = Date.now();

// Bij tool-call
const elapsed = Date.now() - poseStartTimeRef.current;
if (elapsed < MIN_POSE_DURATION) {
  const remaining = Math.ceil((MIN_POSE_DURATION - elapsed) / 1000);
  // Stuur terug: "nog X seconden"
} else {
  // Wissel beeld, reset timer
  poseStartTimeRef.current = Date.now();
  currentPoseIndexRef.current++;
  onShowPose(currentPoseIndexRef.current);
  // Stuur bevestiging
}
```

### 4. Verwijderen
- Transcript-detectie logica (niet meer nodig)
- Word count tracking
- Transition phrase detection

## Volgende stappen
1. [ ] Pas `yogaInstructions.ts` aan met nieuwe workflow
2. [ ] Voeg tool toe aan session API
3. [ ] Implementeer timer + tool-call handler in `useRealtimeYoga.ts`
4. [ ] Verwijder transcript-detectie code
5. [ ] Test flow
6. [ ] Deploy en valideer
