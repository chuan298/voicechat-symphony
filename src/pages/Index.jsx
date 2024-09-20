import ChatInterface from '../components/ChatInterface';

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:mx-auto w-full max-w-6xl">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-light-blue-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <h1 className="text-4xl font-bold mb-4 text-center text-gray-800">Voice Chat Bot</h1>
          <div className="h-[calc(100vh-300px)]">
            <ChatInterface />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;