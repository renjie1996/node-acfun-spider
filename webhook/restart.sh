#! /bin/bash
cnpm i
NODE_ARGV_OPT=get_roll_article NODE_ARGV_3=5  pm2 start index.js
pm2 restart webhook/index.js