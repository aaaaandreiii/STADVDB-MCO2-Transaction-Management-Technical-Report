Source: https://drive.google.com/drive/folders/11IpWBL3_2bsQ-1X5kkNKuS1HPGM7CeaR?usp=sharing

# To update each deployed app:
ssh -p 60415 root@ccscloud.dlsu.edu.ph (change 60415 to 60416 or 60417 respectively to access each server)
<ourPassword>
cd /var/www/myapp
git pull
npm i (ONLY if there are dependency updates)
pm2 restart myapp

# To run:
cd node1
npm i express dotenv axios hbs mysql2
npm start