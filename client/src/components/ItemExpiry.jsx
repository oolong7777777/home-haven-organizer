export default function ItemExpiry({ value, onChange, disabled }) {
  return <fieldset className="haven-expiry-editor">
    <legend>物品期限</legend>
    <label>期限类型<select value={value === null ? 'permanent' : 'dated'} disabled={disabled} onChange={e => onChange(e.target.value === 'permanent' ? null : '')}><option value="permanent">永久有效</option><option value="dated">指定到期日</option></select></label>
    {value !== null && <label>有效期至<input type="date" required value={value || ''} disabled={disabled} min="0001-01-01" max="9999-12-31" onChange={e => onChange(e.target.value)} /></label>}
    <p>到期日当天仍有效；距到期日 30 天内标为临期。</p>
  </fieldset>
}
