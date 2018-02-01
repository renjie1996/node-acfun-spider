#! /bin/bash
NODE_ARGV_OPT=get_roll_article NODE_ARGV_3=5  pm2 restart index.js
pm2 restart webhook/index.js