"""CLI entry point for Stage 1 data collection."""
import click
import yaml
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


@click.command()
@click.option("--n-games", default=None, type=int, help="Number of games to collect")
@click.option("--n-workers", default=None, type=int, help="Parallel worker threads")
@click.option("--save-dir", default=None, type=str, help="Output directory")
@click.option("--checkpoint-every", default=None, type=int, help="Save checkpoint every N games")
@click.option("--config", default="config.yaml", type=str, help="Path to config file")
@click.option("--seed", default=None, type=int, help="Random seed")
def main(n_games, n_workers, save_dir, checkpoint_every, config, seed):
    """Collect Monopoly game data using the Groq LLM agent."""
    # Load config
    cfg = {}
    if Path(config).exists():
        with open(config) as f:
            cfg = yaml.safe_load(f) or {}
    col_cfg = cfg.get("collection", {})
    llm_cfg = cfg.get("llm", {})
    game_cfg = cfg.get("game", {})

    # CLI args override config
    n_games = n_games or col_cfg.get("n_games", 1000)
    n_workers = n_workers or col_cfg.get("n_workers", 4)
    save_dir = save_dir or col_cfg.get("save_dir", "data_collected")
    checkpoint_every = checkpoint_every or col_cfg.get("checkpoint_every", 50)

    click.echo(f"Starting data collection: {n_games} games -> {save_dir}/")

    from data.collector import DataCollector
    collector = DataCollector(
        n_games=n_games,
        save_dir=save_dir,
        n_workers=n_workers,
        checkpoint_every=checkpoint_every,
        llm_model=llm_cfg.get("model", "llama-3.1-70b-versatile"),
        llm_temperature=llm_cfg.get("temperature", 0.3),
        max_tokens=llm_cfg.get("max_tokens", 256),
        cache_enabled=llm_cfg.get("cache_enabled", True),
        n_players=game_cfg.get("n_players", 4),
        max_turns=game_cfg.get("max_turns", 500),
        seed=seed,
    )
    collector.collect()


if __name__ == "__main__":
    main()
