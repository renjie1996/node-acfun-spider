#! /bin/bash
cnpm i
pm2 restart spider.js
pm2 restart webhook/index.js