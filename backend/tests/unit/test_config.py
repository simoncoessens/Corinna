"""Unit tests for configuration classes."""

import os
import pytest
from unittest.mock import patch


class TestCompanyResearcherConfiguration:
    """Tests for company_researcher Configuration class."""

    def test_configuration_defaults(self):
        """Test Configuration has sensible defaults."""
        from company_researcher.configuration import Configuration
        
        config = Configuration()
        
        assert config.research_model == "openai:deepseek-chat"
        assert config.research_model_max_tokens == 4000
        assert config.summarization_model == "openai:deepseek-chat"
        assert config.max_research_iterations == 1
        assert config.max_search_results == 10
        assert config.max_search_queries == 1
        assert config.max_content_length == 15000
        assert config.max_concurrent_research == 17

    def test_configuration_from_runnable_config(self):
        """Test Configuration.from_runnable_config with custom values."""
        from company_researcher.configuration import Configuration
        
        runnable_config = {
            "configurable": {
                "max_research_iterations": 3,
                "max_search_results": 5,
            }
        }
        
        config = Configuration.from_runnable_config(runnable_config)
        
        assert config.max_research_iterations == 3
        assert config.max_search_results == 5
        # Defaults should still apply for unset values
        assert config.research_model == "openai:deepseek-chat"

    def test_configuration_from_env_vars(self):
        """Test Configuration.from_runnable_config with env vars."""
        from company_researcher.configuration import Configuration
        
        with patch.dict(os.environ, {
            "MAX_RESEARCH_ITERATIONS": "5",
            "MAX_SEARCH_QUERIES": "2",
        }):
            config = Configuration.from_runnable_config(None)
            
            assert config.max_research_iterations == 5
            assert config.max_search_queries == 2

    def test_configuration_from_none_config(self):
        """Test Configuration.from_runnable_config with None."""
        from company_researcher.configuration import Configuration
        
        config = Configuration.from_runnable_config(None)
        
        # Should use defaults
        assert config.research_model == "openai:deepseek-chat"
        assert config.max_research_iterations == 1

    def test_configuration_custom_values(self):
        """Test Configuration with custom values."""
        from company_researcher.configuration import Configuration
        
        config = Configuration(
            research_model="openai:gpt-4",
            max_research_iterations=5,
            max_search_results=20,
        )
        
        assert config.research_model == "openai:gpt-4"
        assert config.max_research_iterations == 5
        assert config.max_search_results == 20


class TestMainAgentConfiguration:
    """Tests for main_agent Configuration class."""

    def test_main_agent_configuration_exists(self):
        """Test main_agent Configuration class exists."""
        from main_agent.configuration import Configuration
        
        config = Configuration()
        
        # Should have max_tokens attribute
        assert hasattr(config, "max_tokens")

    def test_main_agent_configuration_from_runnable_config(self):
        """Test main_agent Configuration.from_runnable_config."""
        from main_agent.configuration import Configuration
        
        config = Configuration.from_runnable_config(None)
        
        # Should work without errors
        assert config is not None
