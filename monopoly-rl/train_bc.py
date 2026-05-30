"""CLI entry point for Stage 1 Behavioral Cloning training."""
import click
import yaml
from pathlib import Path


@click.command()
@click.option("--data-dir", default=None, type=str, help="Directory with .npz files")
@click.option("--save-dir", default=None, type=str, help="Directory to save models")
@click.option("--epochs", default=None, type=int, help="Training epochs")
@click.option("--batch-size", default=None, type=int, help="Batch size")
@click.option("--lr", default=None, type=float, help="Learning rate")
@click.option("--device", default=None, type=str, help="cuda / cpu / auto")
@click.option("--wandb/--no-wandb", "use_wandb", default=False, help="Enable W&B logging")
@click.option("--config", default="config.yaml", type=str, help="Path to config file")
def main(data_dir, save_dir, epochs, batch_size, lr, device, use_wandb, config):
    """Train behavioral cloning policy from collected LLM game data."""
    # Load config
    cfg = {}
    if Path(config).exists():
        with open(config) as f:
            cfg = yaml.safe_load(f) or {}
    bc_cfg = cfg.get("behavioral_cloning", {})
    col_cfg = cfg.get("collection", {})

    # CLI args override config
    data_dir = data_dir or col_cfg.get("save_dir", "data_collected")
    save_dir = save_dir or bc_cfg.get("save_dir", "models/bc")
    epochs = epochs or bc_cfg.get("epochs", 50)
    batch_size = batch_size or bc_cfg.get("batch_size", 256)
    lr = lr or bc_cfg.get("lr", 3e-4)
    device = device or bc_cfg.get("device", "auto")

    click.echo(f"Loading data from {data_dir}/...")
    from data.collector import DataCollector
    collector = DataCollector(save_dir=data_dir)
    try:
        observations, actions = collector.load_all()
    except FileNotFoundError as e:
        click.echo(f"Error: {e}")
        click.echo("Run collect_data.py first to generate training data.")
        raise SystemExit(1)

    click.echo(f"Loaded {len(actions):,} steps from {data_dir}/")
    click.echo(f"Obs shape: {observations.shape} | Actions: {actions.max()+1} unique")

    from training.bc_trainer import BCTrainer
    trainer = BCTrainer(
        observations=observations,
        actions=actions,
        save_dir=save_dir,
        epochs=epochs,
        batch_size=batch_size,
        lr=lr,
        val_split=bc_cfg.get("val_split", 0.1),
        device=device,
        early_stop_patience=bc_cfg.get("early_stop_patience", 5),
        use_wandb=use_wandb,
    )
    trainer.train()


if __name__ == "__main__":
    main()
