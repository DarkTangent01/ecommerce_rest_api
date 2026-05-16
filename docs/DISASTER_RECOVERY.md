# Disaster Recovery and Backup Strategy

## Recovery Objectives

- RPO target: 15 minutes for MongoDB operational data.
- RTO target: 60 minutes for API restoration.

## Backups

- Run scheduled MongoDB snapshots at least every 15 minutes in production.
- Store encrypted backups in a separate account/region.
- Retain daily backups for 35 days and monthly backups for 12 months.

## Restore

1. Freeze writes by disabling public ingress.
2. Restore MongoDB snapshot into a new cluster.
3. Rebuild indexes.
4. Replay durable domain events after the snapshot timestamp when available.
5. Run consistency checks for orders, payments, inventory reservations, and shipments.
6. Repoint application secrets/configuration to the restored cluster.

## Drills

- Run quarterly restore drills.
- Run chaos tests for queue outage, cache outage, webhook replay, and checkout lock contention.

## PCI Notes

This API must not store PAN, CVV, magnetic stripe, or raw cardholder authentication data. Payment providers should tokenize card details outside this system.
