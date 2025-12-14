-- =============================================================================
-- Supabase Migration for Admin Dashboard Database
-- =============================================================================
-- This migration creates all tables needed for the admin dashboard
-- Run this in your Supabase SQL Editor
-- =============================================================================

-- Create enum types
CREATE TYPE session_status AS ENUM (
    'started',
    'company_matched',
    'researching',
    'research_complete',
    'classifying',
    'completed',
    'error',
    'abandoned'
);

CREATE TYPE step_type AS ENUM (
    'company_matcher',
    'company_researcher',
    'service_categorizer',
    'main_agent'
);

-- =============================================================================
-- Sessions Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(36) PRIMARY KEY,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Session info
    status session_status NOT NULL DEFAULT 'started',
    
    -- Company info
    company_name VARCHAR(500),
    company_domain VARCHAR(500),
    country VARCHAR(100),
    
    -- Research summary
    is_manual_entry BOOLEAN DEFAULT FALSE,
    research_summary JSONB,
    
    -- Classification result
    service_category VARCHAR(100),
    is_in_scope BOOLEAN,
    is_vlop BOOLEAN,
    applicable_obligations_count INTEGER,
    total_obligations_count INTEGER,
    
    -- Final compliance report
    compliance_report JSONB,
    
    -- Metrics
    total_duration_seconds DOUBLE PRECISION,
    total_llm_calls INTEGER DEFAULT 0,
    total_search_calls INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    estimated_cost_usd DOUBLE PRECISION DEFAULT 0.0,
    
    -- Error tracking
    error_message TEXT,
    
    -- User agent / metadata
    user_agent VARCHAR(500),
    ip_address VARCHAR(50)
);

-- =============================================================================
-- Session Steps Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS session_steps (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Step info
    step_type step_type NOT NULL,
    status VARCHAR(50) DEFAULT 'started',
    
    -- Request/Response data
    request_data JSONB,
    response_data JSONB,
    
    -- Metrics
    duration_seconds DOUBLE PRECISION,
    llm_calls INTEGER DEFAULT 0,
    search_calls INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    
    -- Sources found
    sources_found JSONB,
    
    -- Error tracking
    error_message TEXT
);

-- =============================================================================
-- Chat Messages Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Message info
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    
    -- Context
    frontend_context TEXT,
    context_mode VARCHAR(50),
    
    -- Metrics
    duration_seconds DOUBLE PRECISION,
    tools_used JSONB,
    sources_cited JSONB
);

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_company_name ON sessions(company_name);
CREATE INDEX IF NOT EXISTS idx_sessions_company_domain ON sessions(company_domain);
CREATE INDEX IF NOT EXISTS idx_sessions_service_category ON sessions(service_category);

-- Session steps indexes
CREATE INDEX IF NOT EXISTS idx_session_steps_session_id ON session_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_session_steps_step_type ON session_steps(step_type);
CREATE INDEX IF NOT EXISTS idx_session_steps_created_at ON session_steps(created_at DESC);

-- Chat messages indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON chat_messages(role);

-- =============================================================================
-- Function to automatically update updated_at timestamp
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on sessions
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Row Level Security (RLS) - Optional
-- =============================================================================
-- Uncomment if you want to enable RLS for additional security
-- ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE session_steps ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Example policy (adjust based on your needs):
-- CREATE POLICY "Allow all operations for service role" ON sessions
--     FOR ALL USING (true);

-- =============================================================================
-- Comments for Documentation
-- =============================================================================
COMMENT ON TABLE sessions IS 'Stores complete assessment sessions for the admin dashboard';
COMMENT ON TABLE session_steps IS 'Stores individual steps/API calls within sessions';
COMMENT ON TABLE chat_messages IS 'Stores chat messages between users and the main agent';
