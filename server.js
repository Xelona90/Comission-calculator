
import express from 'express';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Database Schema
const initDb = async () => {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('Database schema initialized successfully.');
    }
  } catch (err) {
    console.error('Error initializing database schema:', err);
  }
};

initDb();

// API Routes

// GET Configuration
app.get('/api/config', async (req, res) => {
  const client = await pool.connect();
  try {
    const profilesRes = await client.query('SELECT * FROM commission_profiles');
    const managersRes = await client.query('SELECT * FROM managers');
    const subsRes = await client.query('SELECT * FROM manager_subordinates');
    const settingsRes = await client.query('SELECT * FROM rep_settings');
    const betaRes = await client.query('SELECT * FROM beta_mappings');

    // Reconstruct nested objects
    const managers = managersRes.rows.map(m => ({
      id: m.id,
      name: m.name,
      profileId: m.profile_id,
      subordinates: subsRes.rows
        .filter(s => s.manager_id === m.id)
        .map(s => s.rep_name)
    }));

    const repSettings = settingsRes.rows.map(r => ({
      name: r.rep_name,
      profileId: r.profile_id
    }));

    const betaMappings = betaRes.rows.map(b => ({
      betaSubgroup: b.beta_subgroup,
      assignedRepName: b.assigned_rep_name
    }));

    // Parse JSONB rules for profiles
    const profiles = profilesRes.rows.map(p => ({
      ...p,
      rules: p.rules // pg automatically parses JSON columns
    }));

    res.json({
      profiles: profiles.length > 0 ? profiles : null,
      managers: managers.length > 0 ? managers : null,
      repSettings: repSettings.length > 0 ? repSettings : null,
      betaMappings: betaMappings.length > 0 ? betaMappings : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  } finally {
    client.release();
  }
});

// POST Configuration (Save)
app.post('/api/config', async (req, res) => {
  const { profiles, managers, repSettings, betaMappings } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Save Profiles (Upsert)
    if (profiles && Array.isArray(profiles)) {
      for (const p of profiles) {
        await client.query(`
          INSERT INTO commission_profiles (id, name, rules)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rules = EXCLUDED.rules
        `, [p.id, p.name, JSON.stringify(p.rules)]);
      }
    }

    // 2. Save Managers (Upsert & Subordinates Refresh)
    if (managers && Array.isArray(managers)) {
      for (const m of managers) {
        // Upsert Manager
        await client.query(`
          INSERT INTO managers (id, name, profile_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, profile_id = EXCLUDED.profile_id
        `, [m.id, m.name, m.profileId]);

        // Refresh Subordinates
        await client.query('DELETE FROM manager_subordinates WHERE manager_id = $1', [m.id]);
        if (m.subordinates && m.subordinates.length > 0) {
          for (const sub of m.subordinates) {
            await client.query(`
              INSERT INTO manager_subordinates (manager_id, rep_name) 
              VALUES ($1, $2) ON CONFLICT DO NOTHING
            `, [m.id, sub]);
          }
        }
      }
    }

    // 3. Save Rep Settings
    if (repSettings && Array.isArray(repSettings)) {
      for (const r of repSettings) {
        await client.query(`
          INSERT INTO rep_settings (rep_name, profile_id)
          VALUES ($1, $2)
          ON CONFLICT (rep_name) DO UPDATE SET profile_id = EXCLUDED.profile_id
        `, [r.name, r.profileId]);
      }
    }

    // 4. Save Beta Mappings
    if (betaMappings && Array.isArray(betaMappings)) {
      for (const b of betaMappings) {
        await client.query(`
          INSERT INTO beta_mappings (beta_subgroup, assigned_rep_name)
          VALUES ($1, $2)
          ON CONFLICT (beta_subgroup) DO UPDATE SET assigned_rep_name = EXCLUDED.assigned_rep_name
        `, [b.betaSubgroup, b.assignedRepName]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to save configuration' });
  } finally {
    client.release();
  }
});

// Serve frontend in production (optional placeholder)
app.use(express.static('dist'));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
