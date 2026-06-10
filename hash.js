const bcrypt = require("bcrypt");
const fs = require("fs");

const saltRounds = 10;
const hashedPassword = bcrypt.hashSync("qwerty", saltRounds);

fs.writeFileSync("password.txt", hashedPassword);