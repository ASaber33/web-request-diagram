# Three-route HTTP server

This is a small Node.js server that demonstrates the HTTP contract:

## How it works

The client sends a request to the server. `GET` returns saved users or products, while `POST` receives JSON data, creates an ID, and saves it in `users.json` or `products.json`. Data remains available when the server restarts.

```text
GET /home     -> 200 OK + home JSON
GET /user     -> 200 OK + users JSON
POST /user    -> 201 Created + saves a user to users.json
GET /product  -> 200 OK + products JSON
POST /product -> 201 Created + saves a product to products.json
```

Opening `/` redirects to `/home`.

## Run

```powershell
cd task3
npm start
```

Then open these URLs in a browser or send requests from PowerShell:

```powershell
curl http://localhost:3000/home
curl http://localhost:3000/user
curl http://localhost:3000/product

curl -X POST http://localhost:3000/user `
	-H "Content-Type: application/json" `
	-d '{"name":"Lina Noor","role":"tester"}'

curl -X POST http://localhost:3000/product `
	-H "Content-Type: application/json" `
	-d '{"name":"Backend Basics","price":35}'
```

## Add data from PowerShell

Keep `npm start` running in one terminal. Open a second PowerShell terminal and run:

### Add a user

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/user" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"name":"Lina Noor","role":"tester"}'
```

### Add a product

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/product" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"name":"Backend Basics","price":35}'
```

The server creates the `id` automatically. To see all users or products:

```powershell
Invoke-RestMethod http://localhost:3000/user
Invoke-RestMethod http://localhost:3000/product
```

Users posted to `/user` are saved in `users.json`; products posted to `/product` are saved in `products.json`. Both remain available after the server restarts. An unknown URL returns `404 Not Found`. A method other than `GET` or `POST` on either endpoint returns `405 Method Not Allowed` and an `Allow: GET, POST` header.

## Verify

```powershell
npm test
```



























												
													Creativa Hub Port Said




<!-- 
⣿⣿⣿⣿⣿⣿⠿⢋⣥⣴⣶⣶⣶⣬⣙⠻⠟⣋⣭⣭⣭⣭⡙⠻⣿⣿⣿⣿⣿
⣿⣿⣿⣿⡿⢋⣴⣿⣿⠿⢟⣛⣛⣛⠿⢷⡹⣿⣿⣿⣿⣿⣿⣆⠹⣿⣿⣿⣿
⣿⣿⣿⡿⢁⣾⣿⣿⣴⣿⣿⣿⣿⠿⠿⠷⠥⠱⣶⣶⣶⣶⡶⠮⠤⣌⡙⢿⣿
⣿⡿⢛⡁⣾⣿⣿⣿⡿⢟⡫⢕⣪⡭⠥⢭⣭⣉⡂⣉⡒⣤⡭⡉⠩⣥⣰⠂⠹
⡟⢠⣿⣱⣿⣿⣿⣏⣛⢲⣾⣿⠃⠄⠐⠈⣿⣿⣿⣿⣿⣿⠄⠁⠃⢸⣿⣿⡧
⢠⣿⣿⣿⣿⣿⣿⣿⣿⣇⣊⠙⠳⠤⠤⠾⣟⠛⠍⣹⣛⣛⣢⣀⣠⣛⡯⢉⣰
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡶⠶⢒⣠⣼⣿⣿⣛⠻⠛⢛⣛⠉⣴⣿⣿
⣿⣿⣿⣿⣿⣿⣿⡿⢛⡛⢿⣿⣿⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡈⢿⣿				UNTILL WE MEET AGAIN 
⣿⣿⣿⣿⣿⣿⣿⠸⣿⡻⢷⣍⣛⠻⠿⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⢇⡘⣿					NEXT SESSION
⣿⣿⣿⣿⣿⣿⣿⣷⣝⠻⠶⣬⣍⣛⣛⠓⠶⠶⠶⠤⠬⠭⠤⠶⠶⠞⠛⣡⣿						. .
⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣶⣬⣭⣍⣙⣛⣛⣛⠛⠛⠛⠿⠿⠿⠛⣠⣿⣿						 O
⣦⣈⠉⢛⠻⠿⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠿⠛⣁⣴⣾⣿⣿⣿⣿
⣿⣿⣿⣶⣮⣭⣁⣒⣒⣒⠂⠠⠬⠭⠭⠭⢀⣀⣠⣄⡘⠿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⡈⢿⣿⣿⣿⣿⣿ -->
