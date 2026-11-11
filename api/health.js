export default function handler(_req, res) {
  res.status(200).json({ service: 'nowera-management', status: 'ok' });
}
