import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#003594', '#0051DC', '#2B7BE8', '#54A6F5', '#7ED1FF'];

function CategoryPieChart({ data }) {
  // Procesar datos para contar tickets por categoría
  const processedData = Object.entries(
    data.reduce((acc, ticket) => {
      const category = ticket.amv_categoriadelasolicitud || 'No especificada';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="bg-white rounded-xl p-4 shadow">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribución por Categoría</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={processedData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            >
              {processedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default CategoryPieChart; 