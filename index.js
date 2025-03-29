import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

const app = express();
const port = 3000;

// PostgreSQL Connection Setup
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }, // Enable SSL for Render
});

// Test database connection
pool.connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch((err) => console.error("Database connection error:", err));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

let users = [
  { id: 1, name: "Angela", color: "teal" },
  { id: 2, name: "Jack", color: "powderblue" },
];

async function checkVisited() {
  try {
    const result = await pool.query(
      "SELECT country_code FROM visited_countries WHERE user_id = $1;",
      [currentUserId]
    );

    return result.rows.map(row => row.country_code);
  } catch (err) {
    console.error("Error fetching visited countries:", err);
    return [];
  }
}

async function getCurrentUser() {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [currentUserId]);
    return result.rows[0] || null;
  } catch (err) {
    console.error("Error fetching user:", err);
    return null;
  }
}

app.get("/", async (req, res) => {
  try {
    const countries = await checkVisited();
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return res.status(404).send("User not found");
    }

    res.render("index.ejs", {
      countries,
      total: countries.length,
      users,
      color: currentUser.color,
    });
  } catch (err) {
    console.error("Error in GET /:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];

  try {
    const result = await pool.query(
      "SELECT country_code FROM various_countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    if (result.rows.length === 0) {
      console.log("No matching country found");
      return res.redirect("/");
    }

    const countryCode = result.rows[0].country_code;

    try {
      await pool.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [countryCode, currentUserId]
      );
    } catch (err) {
      console.error("Error inserting visited country:", err);
    }

  } catch (err) {
    console.error("Error fetching country code:", err);
  }
  
  res.redirect("/");
});

app.post("/user", (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = parseInt(req.body.user, 10) || currentUserId;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const { name, color } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING id;",
      [name, color]
    );

    if (result.rows.length > 0) {
      currentUserId = result.rows[0].id;
    }
  } catch (err) {
    console.error("Error creating new user:", err);
  }

  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
