#!/usr/bin/env bash
/usr/bin/systemctl start lid-resume-unblank.service
sleep 1
/usr/bin/systemctl status lid-resume-unblank.service --no-pager -l || true
echo "--- journal ---"
/usr/bin/journalctl -u lid-resume-unblank.service -n 15 --no-pager || true
