import './App.css';
import Header from './components/layout/Header';

function App() {
  return (
    <div className="App">
      <Header />
      <main className="App-main">
        <h1>Welcome to BudgetBliss</h1>
        <p>Your daily spending visualization tool</p>
      </main>
    </div>
  );
}

export default App;
