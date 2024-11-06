CREATE TABLE extension(extID INTEGER NOT NULL PRIMARY
KEY,name TEXT NOT NULL, hyperlink TEXT NOT NULL,about TEXT
NOT NULL,image TEXT NOT NULL,language TEXT NOT NULL);
INSERT INTO extension(extID,name,hyperlink,about,image,language)
VALUES (1,&quot;Live
Server&quot;,&quot;https://marketplace.visualstudio.com/items?itemName=ritwickdey
.LiveServer&quot;,&quot;Launch a development local Server with live reload feature
for static &amp; dynamic
pages&quot;,&quot;https://ritwickdey.gallerycdn.vsassets.io/extensions/ritwickdey/live
server/5.7.9/1661914858952/Microsoft.VisualStudio.Services.Icons.Defau
lt&quot;,&quot;HTML CSS JS&quot;); # V0.9 Ben Jones 15/8/2023
SELECT * FROM extension;
SELECT * FROM extension WHERE language LIKE &#39;#BASH&#39;;