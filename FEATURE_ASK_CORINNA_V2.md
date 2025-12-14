# Ask Corinna Feature V2 - Context-Aware Implementation

## Overview

Enhanced the "Ask Corinna" feature with proper context modes instead of string parsing. Users can now click "Ask Corinna" buttons in both the review phase and the obligations dashboard, with specialized AI behavior for each context.

## Key Improvements

### 1. Explicit Context Modes

Instead of parsing context strings, we now use explicit mode parameters:

- `review_findings` - For understanding research findings
- `obligations` - For understanding DSA obligations
- `general` - Default mode

### 2. Backend Changes

#### State Definition (`backend/agents/main_agent/src/main_agent/state.py`)

```python
class MainAgentInputState(MessagesState):
    frontend_context: Optional[str] = None
    context_mode: Optional[Literal["review_findings", "obligations", "general"]] = None
```

#### API Endpoint (`backend/api/main.py`)

```python
class MainAgentRequest(BaseModel):
    message: str
    frontend_context: Optional[str] = None
    context_mode: Optional[str] = None  # "review_findings", "obligations", or "general"
```

#### System Prompt (`backend/agents/main_agent/src/main_agent/prompts/system.jinja`)

Now uses explicit mode checks:

```jinja
{% if context_mode == "review_findings" %}
## Reviewing Research Findings (CRITICAL)
...
{% elif context_mode == "obligations" %}
## Understanding Obligations (CRITICAL)
...
{% endif %}
```

### 3. Frontend Changes

#### ChatPopup Component (`frontend/src/components/assessment/ChatPopup.tsx`)

Added `contextMode` prop and passes it to API:

```typescript
export type ContextMode = "review_findings" | "obligations" | "general";

interface ChatPopupProps {
  context: ChatContext;
  initialQuestion?: string;
  onInitialQuestionSent?: () => void;
  contextMode?: ContextMode;
}
```

API request now includes context mode:

```typescript
body: JSON.stringify({
  message: userMessage.content,
  frontend_context: fullContext,
  context_mode: contextMode,
});
```

#### ComplianceDashboard (`frontend/src/components/assessment/ComplianceDashboard.tsx`)

Added "Ask Corinna" button to `ObligationDetail` component:

```typescript
interface ComplianceDashboardProps {
  ...
  onAskCorinna?: (obligation: ObligationAnalysis) => void;
}
```

Button placement in obligation detail panel:

```tsx
<button
  onClick={() => onAskCorinna(obligation)}
  className="px-2 py-1 flex items-center gap-1.5 text-[#78716c] hover:text-[#003399] transition-colors"
  title="Ask Corinna about this obligation"
>
  <MessageCircle className="w-3.5 h-3.5" />
  <span className="font-sans text-xs whitespace-nowrap">Ask Corinna</span>
</button>
```

#### Assessment Page (`frontend/src/app/assessment/page.tsx`)

Added state management and handlers:

```typescript
const [contextMode, setContextMode] = useState<ContextMode>("general");

const handleAskCorinna = useCallback((finding: SubQuestionAnswer) => {
  const question = `Help me understand this research finding:...`;
  setContextMode("review_findings");
  setCorinnaQuestion(question);
}, []);

const handleAskCorinnaObligation = useCallback(
  (obligation: ObligationAnalysis) => {
    const question = `Help me understand this DSA obligation:...`;
    setContextMode("obligations");
    setCorinnaQuestion(question);
  },
  []
);

const handleCorinnaQuestionSent = useCallback(() => {
  setCorinnaQuestion("");
  setContextMode("general"); // Reset to general
}, []);
```

## User Experience

### Review Phase ("Ask Corinna" on Research Findings)

1. User clicks "Ask Corinna" next to a research finding
2. Chat opens with pre-formatted question about the finding
3. Corinna explains:
   - What the question is asking
   - Why it matters for DSA compliance
   - Implications of the answer
   - Does NOT judge accuracy (user decides)

### Obligations Dashboard ("Ask Corinna" on Obligations)

1. User clicks "Ask Corinna" in an obligation detail panel
2. Chat opens with pre-formatted question about the obligation
3. Corinna explains:
   - What the DSA article requires in plain language
   - Why it applies (or doesn't) to their service
   - Practical implications and action items
   - Context on deadlines, penalties, exemptions
   - Does NOT provide legal advice

## Technical Benefits

1. **Type Safety**: Explicit mode parameter with TypeScript types
2. **Maintainability**: Easy to add new modes without string parsing
3. **Testability**: Clear mode switching logic
4. **Performance**: No regex or string parsing overhead
5. **Clarity**: Self-documenting code with explicit mode names

## Files Changed

### Backend

- `backend/agents/main_agent/src/main_agent/state.py`
- `backend/agents/main_agent/src/main_agent/graph.py`
- `backend/agents/main_agent/src/main_agent/prompts/system.jinja`
- `backend/api/main.py`

### Frontend

- `frontend/src/components/assessment/ChatPopup.tsx`
- `frontend/src/components/assessment/ComplianceDashboard.tsx`
- `frontend/src/components/assessment/index.ts`
- `frontend/src/app/assessment/page.tsx`

## Future Enhancements

Potential new context modes:

- `classification` - Help understanding service classification
- `research_methodology` - Explain how research works
- `compare_obligations` - Compare multiple obligations
- `deadlines` - Focus on compliance timelines

## Testing

To test:

1. **Review Phase**:

   - Go through company research
   - Click "Ask Corinna" on any finding
   - Verify chat opens with finding details
   - Verify Corinna explains without judging accuracy

2. **Obligations Dashboard**:
   - Complete assessment to reach dashboard
   - Click on any obligation to open detail panel
   - Click "Ask Corinna" in detail panel
   - Verify chat opens with obligation details
   - Verify Corinna explains article requirements and applicability
