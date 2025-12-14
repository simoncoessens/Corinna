"""Tests for main_agent agent nodes."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestMainAgentNodes:
    """Tests for main_agent graph nodes."""

    @pytest.mark.asyncio
    async def test_agent_calls_llm(self, human_message, mock_chat_openai):
        """Test agent node invokes LLM."""
        from main_agent.graph import agent
        
        with patch("main_agent.graph.ChatOpenAI", return_value=mock_chat_openai):
            with patch("main_agent.graph.get_all_tools", return_value=[]):
                state = {"messages": [human_message], "frontend_context": None}
                result = await agent(state)
        
        assert "messages" in result
        assert len(result["messages"]) == 1

    @pytest.mark.asyncio
    async def test_agent_includes_frontend_context(self, human_message, mock_chat_openai):
        """Test agent includes frontend_context in prompt."""
        from main_agent.graph import agent
        
        with patch("main_agent.graph.ChatOpenAI", return_value=mock_chat_openai):
            with patch("main_agent.graph.get_all_tools", return_value=[]):
                state = {
                    "messages": [human_message],
                    "frontend_context": "User is on step 2.",
                }
                result = await agent(state)
        
        assert "messages" in result

    @pytest.mark.asyncio
    async def test_finalize_passes_messages(self, human_message, ai_message):
        """Test finalize node passes messages through."""
        from main_agent.graph import finalize
        
        state = {"messages": [human_message, ai_message]}
        result = await finalize(state)
        
        assert "messages" in result
        assert len(result["messages"]) == 2


class TestMainAgentTools:
    """Tests for main_agent tools."""

    def test_get_all_tools_returns_list(self):
        """Test get_all_tools returns tool list."""
        from main_agent.tools import get_all_tools
        
        tools = get_all_tools()
        
        assert isinstance(tools, list)
        assert len(tools) == 2

    def test_tools_have_web_search(self):
        """Test tools include web_search."""
        from main_agent.tools import get_all_tools
        
        tools = get_all_tools()
        tool_names = [t.name for t in tools]
        
        assert "web_search" in tool_names

    def test_tools_have_dsa_retrieval(self):
        """Test tools include retrieve_dsa_knowledge."""
        from main_agent.tools import get_all_tools
        
        tools = get_all_tools()
        tool_names = [t.name for t in tools]
        
        assert "retrieve_dsa_knowledge" in tool_names


class TestMainAgentGraph:
    """Tests for main_agent graph structure."""

    def test_graph_compiles(self):
        """Test main_agent graph compiles successfully."""
        from main_agent.graph import main_agent
        
        assert main_agent is not None

    def test_graph_has_nodes(self):
        """Test main_agent graph has expected nodes."""
        from main_agent.graph import _builder
        
        assert "agent" in _builder.nodes
        assert "tools" in _builder.nodes
        assert "finalize" in _builder.nodes


class TestMainAgentCredentials:
    """Tests for main_agent credential handling."""

    def test_get_api_credentials_from_env(self):
        """Test _get_api_credentials from environment."""
        from main_agent.graph import _get_api_credentials
        
        with patch.dict("os.environ", {
            "OPENAI_API_KEY": "env-key",
            "OPENAI_BASE_URL": "http://env-url",
        }):
            api_key, base_url = _get_api_credentials(None)
            
            assert api_key == "env-key"
            assert base_url == "http://env-url"

    def test_get_api_credentials_from_config(self):
        """Test _get_api_credentials from config overrides env."""
        from main_agent.graph import _get_api_credentials
        
        config = {
            "configurable": {
                "apiKeys": {
                    "OPENAI_API_KEY": "config-key",
                    "OPENAI_BASE_URL": "http://config-url",
                }
            }
        }
        
        with patch.dict("os.environ", {"OPENAI_API_KEY": "env-key"}):
            api_key, base_url = _get_api_credentials(config)
            
            assert api_key == "config-key"
            assert base_url == "http://config-url"
