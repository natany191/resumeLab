import Layout from './components/Layout'
import WelcomeForm from './components/WelcomeForm'
import { useAppStore } from './store/useAppStore'

function App() {
  const { currentScreen, userBasicInfo, setUserBasicInfo, goToChat } = useAppStore();

  const handleWelcomeComplete = (data: any) => {
    setUserBasicInfo(data);
    goToChat();
  };

  if (currentScreen === 'welcome') {
    return <WelcomeForm onComplete={handleWelcomeComplete} />;
  }

  return <Layout userBasicInfo={userBasicInfo} />;
}

export default App