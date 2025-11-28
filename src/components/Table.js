import React from 'react';

const Table = ({ title, data, columns, onDataChange }) => {
  const handleInputChange = (rowIndex, key, value) => {
    onDataChange(rowIndex, key, value);
  };

  return (
    <div className="table-container">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.editable ? (
                    <input
                      type="text"
                      value={row[col.key] || ''}
                      onChange={(e) => handleInputChange(rowIndex, col.key, e.target.value)}
                    />
                  ) : (
                    row[col.key]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;